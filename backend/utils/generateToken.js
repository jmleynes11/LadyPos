import jwt from 'jsonwebtoken';
import { accountTokenVersion } from './tokenVersion.js';
import { ACCESS_TOKEN_LIFETIME_SECONDS } from './tokenPolicy.js';

export async function generateToken(user) {
    return jwt.sign(
        { id: user._id, role: user.role, tokenVersion: accountTokenVersion(user.tokenVersion) },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS }
    );
}
