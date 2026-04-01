import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'leanislaw-dev-secret-change-in-production';

export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const token = header.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = Number(payload.sub);
        req.userEmail = payload.email;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export { JWT_SECRET };
