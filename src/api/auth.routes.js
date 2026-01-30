import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { registerUser, loginUser, getUserProfile } from '../Db/databaseManager.js';
import { verifyToken } from '../middleware/authMiddleware.js';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET = process.env.ADMIN_CREATION_SECRET;

// 1. User Signup
authRouter.post('/signup', [
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { email, password, name } = req.body;
        const user = await registerUser({ email, password, name, role: 'user' });

        // Create Token
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ token, user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 2. Admin Signup (Protected by Secret Code)
authRouter.post('/admin/signup', [
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('adminSecret').exists() // Must provide the secret code from .env
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { email, password, name, adminSecret } = req.body;

        // Security Check
        if (adminSecret !== ADMIN_SECRET) {
            return res.status(403).json({ error: "Invalid Admin Secret Code" });
        }

        const user = await registerUser({ email, password, name, role: 'admin' });
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ token, user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 3. Login (Common for User & Admin)
authRouter.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await loginUser(email, password);
        
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(200).json({ token, user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 4. Get Current User Data
authRouter.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await getUserProfile(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});