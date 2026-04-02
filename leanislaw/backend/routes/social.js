import express from 'express';
import pool, { db } from '../db.js';
import { users, userFriendships, friendRequests } from '../schema.js';
import { eq, or, and, inArray, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { resolveAvatarUrl } from '../lib/userAvatar.js';
import { normalizeUsername } from '../lib/username.js';

const router = express.Router();

function publicCard(row) {
    if (!row) return null;
    return {
        id: row.id,
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        avatar_url: resolveAvatarUrl(row),
    };
}

function orderedPair(userId, friendId) {
    const a = Number(userId);
    const b = Number(friendId);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1) return null;
    if (a === b) return null;
    return a < b ? [a, b] : [b, a];
}

const userSelectCols = {
    id: users.id,
    username: users.username,
    first_name: users.first_name,
    last_name: users.last_name,
    profile_image_url: users.profile_image_url,
};

async function loadUserRow(userId) {
    const rows = await db.select(userSelectCols).from(users).where(eq(users.id, userId)).limit(1);
    return rows[0] ?? null;
}

async function friendshipExists(pair) {
    const rows = await db
        .select({ user_a_id: userFriendships.user_a_id })
        .from(userFriendships)
        .where(and(eq(userFriendships.user_a_id, pair[0]), eq(userFriendships.user_b_id, pair[1])))
        .limit(1);
    return rows.length > 0;
}

async function acceptPendingRequest(requestId, me, otherUserId) {
    const pair = orderedPair(me, otherUserId);
    if (!pair) throw new Error('Invalid pair');
    await db.transaction(async (tx) => {
        await tx
            .insert(userFriendships)
            .values({
                user_a_id: pair[0],
                user_b_id: pair[1],
            })
            .onConflictDoNothing({
                target: [userFriendships.user_a_id, userFriendships.user_b_id],
            });
        const updated = await tx
            .update(friendRequests)
            .set({ status: 'accepted' })
            .where(
                and(
                    eq(friendRequests.id, requestId),
                    eq(friendRequests.to_user_id, me),
                    eq(friendRequests.status, 'pending')
                )
            )
            .returning({ id: friendRequests.id });
        if (updated.length === 0) {
            throw Object.assign(new Error('Request not found or not pending'), { code: 'NOT_PENDING' });
        }
    });
}

function migrationHint503(msg) {
    return (
        /user_friendships|friend_requests|direct_messages|42703|undefined_column|relation .* does not exist/i.test(
            msg
        )
    );
}

let directMessagesTableReady = false;
async function ensureDirectMessagesTable() {
    if (directMessagesTableReady) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS direct_messages (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT direct_messages_no_self CHECK (sender_id <> recipient_id)
        );
        CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_recipient_time
            ON direct_messages (sender_id, recipient_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_sender_time
            ON direct_messages (recipient_id, sender_id, created_at DESC);
    `);
    directMessagesTableReady = true;
}

const DM_MAX_LEN = 4000;

// GET /api/v1/social/friends
router.get('/friends', requireAuth, async (req, res) => {
    const me = req.userId;
    try {
        const edges = await db
            .select({
                user_a_id: userFriendships.user_a_id,
                user_b_id: userFriendships.user_b_id,
            })
            .from(userFriendships)
            .where(or(eq(userFriendships.user_a_id, me), eq(userFriendships.user_b_id, me)));

        const friendIds = [
            ...new Set(edges.map((e) => (e.user_a_id === me ? e.user_b_id : e.user_a_id))),
        ];
        if (friendIds.length === 0) {
            return res.json([]);
        }

        const rows = await db.select(userSelectCols).from(users).where(inArray(users.id, friendIds));

        res.json(rows.map(publicCard));
    } catch (err) {
        console.error('GET /social/friends error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (migrationHint503(msg)) {
            return res.status(503).json({
                error: 'Run migrations 015_user_friendships.sql and 016_friend_requests.sql (npm run migrate).',
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/social/friend-requests/incoming
router.get('/friend-requests/incoming', requireAuth, async (req, res) => {
    const me = req.userId;
    try {
        const rows = await db
            .select({
                id: friendRequests.id,
                created_at: friendRequests.created_at,
                from_id: users.id,
                username: users.username,
                first_name: users.first_name,
                last_name: users.last_name,
                profile_image_url: users.profile_image_url,
            })
            .from(friendRequests)
            .innerJoin(users, eq(users.id, friendRequests.from_user_id))
            .where(and(eq(friendRequests.to_user_id, me), eq(friendRequests.status, 'pending')))
            .orderBy(desc(friendRequests.created_at));

        res.json(
            rows.map((r) => ({
                id: r.id,
                created_at: r.created_at,
                from: publicCard({
                    id: r.from_id,
                    username: r.username,
                    first_name: r.first_name,
                    last_name: r.last_name,
                    profile_image_url: r.profile_image_url,
                }),
            }))
        );
    } catch (err) {
        console.error('GET /social/friend-requests/incoming error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (migrationHint503(msg)) {
            return res.status(503).json({
                error: 'Run migration 016_friend_requests.sql (npm run migrate).',
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/social/friend-requests/outgoing
router.get('/friend-requests/outgoing', requireAuth, async (req, res) => {
    const me = req.userId;
    try {
        const rows = await db
            .select({
                id: friendRequests.id,
                created_at: friendRequests.created_at,
                to_id: users.id,
                username: users.username,
                first_name: users.first_name,
                last_name: users.last_name,
                profile_image_url: users.profile_image_url,
            })
            .from(friendRequests)
            .innerJoin(users, eq(users.id, friendRequests.to_user_id))
            .where(and(eq(friendRequests.from_user_id, me), eq(friendRequests.status, 'pending')))
            .orderBy(desc(friendRequests.created_at));

        res.json(
            rows.map((r) => ({
                id: r.id,
                created_at: r.created_at,
                to: publicCard({
                    id: r.to_id,
                    username: r.username,
                    first_name: r.first_name,
                    last_name: r.last_name,
                    profile_image_url: r.profile_image_url,
                }),
            }))
        );
    } catch (err) {
        console.error('GET /social/friend-requests/outgoing error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (migrationHint503(msg)) {
            return res.status(503).json({
                error: 'Run migration 016_friend_requests.sql (npm run migrate).',
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/social/friend-requests/:id/accept
router.post('/friend-requests/:id/accept', requireAuth, async (req, res) => {
    const me = req.userId;
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId < 1) {
        return res.status(400).json({ error: 'Invalid request id.' });
    }
    try {
        const rows = await db
            .select({
                id: friendRequests.id,
                from_user_id: friendRequests.from_user_id,
                to_user_id: friendRequests.to_user_id,
                status: friendRequests.status,
            })
            .from(friendRequests)
            .where(eq(friendRequests.id, requestId))
            .limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Request not found.' });
        }
        const row = rows[0];
        if (row.to_user_id !== me) {
            return res.status(403).json({ error: 'Not your request to accept.' });
        }
        if (row.status !== 'pending') {
            return res.status(409).json({ error: 'This request is no longer pending.' });
        }
        await acceptPendingRequest(requestId, me, row.from_user_id);
        const friendRow = await loadUserRow(row.from_user_id);
        res.status(201).json({ ...publicCard(friendRow), friendshipCreated: true });
    } catch (err) {
        if (err.code === 'NOT_PENDING') {
            return res.status(409).json({ error: 'Request was already handled.' });
        }
        console.error('POST /social/friend-requests/:id/accept error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (migrationHint503(msg)) {
            return res.status(503).json({
                error: 'Run migration 016_friend_requests.sql (npm run migrate).',
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/social/friend-requests/:id/decline
router.post('/friend-requests/:id/decline', requireAuth, async (req, res) => {
    const me = req.userId;
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId < 1) {
        return res.status(400).json({ error: 'Invalid request id.' });
    }
    try {
        const updated = await db
            .update(friendRequests)
            .set({ status: 'declined' })
            .where(
                and(
                    eq(friendRequests.id, requestId),
                    eq(friendRequests.to_user_id, me),
                    eq(friendRequests.status, 'pending')
                )
            )
            .returning({ id: friendRequests.id });
        if (updated.length === 0) {
            return res.status(404).json({ error: 'No pending request found.' });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('POST /social/friend-requests/:id/decline error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (migrationHint503(msg)) {
            return res.status(503).json({
                error: 'Run migration 016_friend_requests.sql (npm run migrate).',
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/v1/social/friend-requests/:id — cancel outgoing pending
router.delete('/friend-requests/:id', requireAuth, async (req, res) => {
    const me = req.userId;
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId < 1) {
        return res.status(400).json({ error: 'Invalid request id.' });
    }
    try {
        const deleted = await db
            .delete(friendRequests)
            .where(
                and(
                    eq(friendRequests.id, requestId),
                    eq(friendRequests.from_user_id, me),
                    eq(friendRequests.status, 'pending')
                )
            )
            .returning({ id: friendRequests.id });
        if (deleted.length === 0) {
            return res.status(404).json({ error: 'No pending outgoing request found.' });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /social/friend-requests/:id error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (migrationHint503(msg)) {
            return res.status(503).json({
                error: 'Run migration 016_friend_requests.sql (npm run migrate).',
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/social/lookup/username/:username — must be registered before /lookup/:userId
router.get('/lookup/username/:username', requireAuth, async (req, res) => {
    const raw = req.params.username != null ? decodeURIComponent(String(req.params.username)) : '';
    const norm = normalizeUsername(raw.replace(/^@/, ''));
    if (norm === undefined || norm === null) {
        return res.status(400).json({ error: 'Invalid username.' });
    }
    try {
        const rows = await db.select(userSelectCols).from(users).where(eq(users.username, norm)).limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No user with that username.' });
        }
        res.json(publicCard(rows[0]));
    } catch (err) {
        console.error('GET /social/lookup/username error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/social/lookup/:userId — minimal card for “add friend” confirmation (auth required)
router.get('/lookup/:userId', requireAuth, async (req, res) => {
    const id = Number(req.params.userId);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid user id.' });
    }
    try {
        const rows = await db.select(userSelectCols).from(users).where(eq(users.id, id)).limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No user with that id.' });
        }
        res.json(publicCard(rows[0]));
    } catch (err) {
        console.error('GET /social/lookup error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/social/friends — send request (or auto-accept if they already requested you)
router.post('/friends', requireAuth, async (req, res) => {
    let friendId;
    const rawId = req.body?.friendUserId ?? req.body?.friend_user_id ?? req.body?.uid;
    if (rawId != null && String(rawId).trim() !== '') {
        friendId = typeof rawId === 'string' ? parseInt(rawId, 10) : Number(rawId);
        if (!Number.isInteger(friendId) || friendId < 1) {
            friendId = undefined;
        }
    }
    const unameRaw = req.body?.friendUsername ?? req.body?.friend_username ?? req.body?.username;
    if ((friendId == null || !Number.isInteger(friendId) || friendId < 1) && unameRaw != null && String(unameRaw).trim() !== '') {
        const norm = normalizeUsername(String(unameRaw).replace(/^@/, ''));
        if (norm === undefined || norm === null) {
            return res.status(400).json({ error: 'Invalid username.' });
        }
        try {
            const rows = await db.select({ id: users.id }).from(users).where(eq(users.username, norm)).limit(1);
            if (rows.length === 0) {
                return res.status(404).json({ error: 'No user with that username.' });
            }
            friendId = rows[0].id;
        } catch (e) {
            console.error('POST /social/friends username resolve:', e);
            return res.status(500).json({ error: e.message });
        }
    }
    if (friendId == null || !Number.isInteger(friendId) || friendId < 1) {
        return res.status(400).json({ error: 'Send friendUserId (number) or friendUsername (handle).' });
    }
    if (friendId === req.userId) {
        return res.status(400).json({ error: 'You cannot add yourself.' });
    }

    const pair = orderedPair(req.userId, friendId);
    if (!pair) {
        return res.status(400).json({ error: 'Invalid ids.' });
    }

    try {
        const exists = await db.select({ id: users.id }).from(users).where(eq(users.id, friendId)).limit(1);
        if (exists.length === 0) {
            return res.status(404).json({ error: 'No user with that id.' });
        }

        if (await friendshipExists(pair)) {
            const row = await loadUserRow(friendId);
            return res.status(200).json({ ...publicCard(row), alreadyFriends: true });
        }

        const incoming = await db
            .select({ id: friendRequests.id })
            .from(friendRequests)
            .where(
                and(
                    eq(friendRequests.from_user_id, friendId),
                    eq(friendRequests.to_user_id, req.userId),
                    eq(friendRequests.status, 'pending')
                )
            )
            .limit(1);

        if (incoming.length > 0) {
            await acceptPendingRequest(incoming[0].id, req.userId, friendId);
            const row = await loadUserRow(friendId);
            return res.status(201).json({ ...publicCard(row), friendshipCreated: true });
        }

        const outgoing = await db
            .select({ id: friendRequests.id })
            .from(friendRequests)
            .where(
                and(
                    eq(friendRequests.from_user_id, req.userId),
                    eq(friendRequests.to_user_id, friendId),
                    eq(friendRequests.status, 'pending')
                )
            )
            .limit(1);

        if (outgoing.length > 0) {
            const row = await loadUserRow(friendId);
            return res.status(200).json({ ...publicCard(row), requestPending: true });
        }

        try {
            await db.insert(friendRequests).values({
                from_user_id: req.userId,
                to_user_id: friendId,
                status: 'pending',
            });
        } catch (insErr) {
            if (insErr.code === '23505') {
                const row = await loadUserRow(friendId);
                return res.status(200).json({ ...publicCard(row), requestPending: true });
            }
            throw insErr;
        }

        const row = await loadUserRow(friendId);
        return res.status(202).json({ ...publicCard(row), requestSent: true });
    } catch (err) {
        console.error('POST /social/friends error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (err.code === '23514' || /user_friendships_ordered/i.test(msg)) {
            return res.status(400).json({ error: 'Invalid friend pair.' });
        }
        if (migrationHint503(msg)) {
            return res.status(503).json({
                error: 'Run migrations 015–017 (friends, requests, DMs). npm run migrate.',
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/social/dm/summaries — last message preview per friend (for inbox)
router.get('/dm/summaries', requireAuth, async (req, res) => {
    const me = req.userId;
    try {
        await ensureDirectMessagesTable();
        const r = await pool.query(
            `WITH friends AS (
                SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS fid
                FROM user_friendships
                WHERE user_a_id = $1 OR user_b_id = $1
            )
            SELECT f.fid AS peer_id,
                m.content AS preview,
                m.created_at AS last_at,
                (m.sender_id = $1) AS from_me
            FROM friends f
            LEFT JOIN LATERAL (
                SELECT content, created_at, sender_id
                FROM direct_messages dm
                WHERE (dm.sender_id = $1 AND dm.recipient_id = f.fid)
                   OR (dm.sender_id = f.fid AND dm.recipient_id = $1)
                ORDER BY dm.created_at DESC, dm.id DESC
                LIMIT 1
            ) m ON true`,
            [me]
        );
        res.json(
            r.rows.map((row) => ({
                peer_id: row.peer_id,
                preview: row.preview != null ? String(row.preview).slice(0, 160) : null,
                last_at: row.last_at,
                from_me: row.from_me === true,
            }))
        );
    } catch (err) {
        console.error('GET /social/dm/summaries error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (migrationHint503(msg)) {
            return res.status(503).json({
                error: 'Run migration 017_direct_messages.sql (npm run migrate).',
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/social/dm/:peerId/messages
router.get('/dm/:peerId/messages', requireAuth, async (req, res) => {
    const me = req.userId;
    const peerId = Number(req.params.peerId);
    if (!Number.isInteger(peerId) || peerId < 1) {
        return res.status(400).json({ error: 'Invalid peer id.' });
    }
    const pair = orderedPair(me, peerId);
    if (!pair) {
        return res.status(400).json({ error: 'Invalid peer.' });
    }
    try {
        await ensureDirectMessagesTable();
        if (!(await friendshipExists(pair))) {
            return res.status(403).json({ error: 'You can only message friends.' });
        }
        const r = await pool.query(
            `SELECT id, sender_id, recipient_id, content, created_at
             FROM direct_messages
             WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
             ORDER BY created_at ASC, id ASC
             LIMIT 250`,
            [me, peerId]
        );
        res.json({ messages: r.rows });
    } catch (err) {
        console.error('GET /social/dm/:peerId/messages error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (migrationHint503(msg)) {
            return res.status(503).json({
                error: 'Run migration 017_direct_messages.sql (npm run migrate).',
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/social/dm/:peerId — { content }
router.post('/dm/:peerId', requireAuth, async (req, res) => {
    const me = req.userId;
    const peerId = Number(req.params.peerId);
    if (!Number.isInteger(peerId) || peerId < 1) {
        return res.status(400).json({ error: 'Invalid peer id.' });
    }
    if (peerId === me) {
        return res.status(400).json({ error: 'Invalid peer.' });
    }
    const pair = orderedPair(me, peerId);
    if (!pair) {
        return res.status(400).json({ error: 'Invalid peer.' });
    }
    const content = String(req.body?.content ?? '').trim().slice(0, DM_MAX_LEN);
    if (!content) {
        return res.status(400).json({ error: 'Message cannot be empty.' });
    }
    try {
        await ensureDirectMessagesTable();
        if (!(await friendshipExists(pair))) {
            return res.status(403).json({ error: 'You can only message friends.' });
        }
        const ins = await pool.query(
            `INSERT INTO direct_messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)
             RETURNING id, sender_id, recipient_id, content, created_at`,
            [me, peerId, content]
        );
        res.status(201).json(ins.rows[0]);
    } catch (err) {
        console.error('POST /social/dm/:peerId error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (migrationHint503(msg)) {
            return res.status(503).json({
                error: 'Run migration 017_direct_messages.sql (npm run migrate).',
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/v1/social/friends/:friendUserId
router.delete('/friends/:friendUserId', requireAuth, async (req, res) => {
    const friendId = Number(req.params.friendUserId);
    const pair = orderedPair(req.userId, friendId);
    if (!pair) {
        return res.status(400).json({ error: 'Invalid friend id.' });
    }
    try {
        await db
            .delete(userFriendships)
            .where(
                and(eq(userFriendships.user_a_id, pair[0]), eq(userFriendships.user_b_id, pair[1]))
            );
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /social/friends error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
