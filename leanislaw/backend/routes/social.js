import express from 'express';
import { db } from '../db.js';
import { users, userFriendships } from '../schema.js';
import { eq, or, and, inArray } from 'drizzle-orm';
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

        const rows = await db
            .select({
                id: users.id,
                username: users.username,
                first_name: users.first_name,
                last_name: users.last_name,
                profile_image_url: users.profile_image_url,
            })
            .from(users)
            .where(inArray(users.id, friendIds));

        res.json(rows.map(publicCard));
    } catch (err) {
        console.error('GET /social/friends error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (/user_friendships|42703|undefined_column|relation .* does not exist/i.test(msg)) {
            return res.status(503).json({
                error: 'Run database migration 015_user_friendships.sql (npm run migrate).',
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
        const rows = await db
            .select({
                id: users.id,
                username: users.username,
                first_name: users.first_name,
                last_name: users.last_name,
                profile_image_url: users.profile_image_url,
            })
            .from(users)
            .where(eq(users.username, norm))
            .limit(1);
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
        const rows = await db
            .select({
                id: users.id,
                username: users.username,
                first_name: users.first_name,
                last_name: users.last_name,
                profile_image_url: users.profile_image_url,
            })
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No user with that id.' });
        }
        res.json(publicCard(rows[0]));
    } catch (err) {
        console.error('GET /social/lookup error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/social/friends — friendUserId / uid, or friendUsername / friend_username / username
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
            const rows = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.username, norm))
                .limit(1);
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
        const exists = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, friendId))
            .limit(1);
        if (exists.length === 0) {
            return res.status(404).json({ error: 'No user with that id.' });
        }

        try {
            await db.insert(userFriendships).values({
                user_a_id: pair[0],
                user_b_id: pair[1],
            });
        } catch (insErr) {
            if (insErr.code === '23505') {
                const [row] = await db
                    .select({
                        id: users.id,
                        username: users.username,
                        first_name: users.first_name,
                        last_name: users.last_name,
                        profile_image_url: users.profile_image_url,
                    })
                    .from(users)
                    .where(eq(users.id, friendId))
                    .limit(1);
                return res.status(200).json({ ...publicCard(row), alreadyFriends: true });
            }
            throw insErr;
        }

        const [row] = await db
            .select({
                id: users.id,
                username: users.username,
                first_name: users.first_name,
                last_name: users.last_name,
                profile_image_url: users.profile_image_url,
            })
            .from(users)
            .where(eq(users.id, friendId))
            .limit(1);
        res.status(201).json(publicCard(row));
    } catch (err) {
        console.error('POST /social/friends error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (err.code === '23514' || /user_friendships_ordered/i.test(msg)) {
            return res.status(400).json({ error: 'Invalid friend pair.' });
        }
        if (/user_friendships|42703|undefined_column|relation .* does not exist/i.test(msg)) {
            return res.status(503).json({
                error: 'Run database migration 015_user_friendships.sql (npm run migrate).',
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
