import { OAuth2Client } from "google-auth-library";
import { ENV } from "../config/env.js";

const clientID = ENV.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(clientID);


export async function verifyGoogleToken(token) {
    if (!token) {
        return { success: false, message: "No token provided" };
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: clientID,
        });

        if (!ticket) {
            return { success: false, message: "Invalid token" };
        }

        const payload = ticket.getPayload();

        if (!payload || !payload.sub || !payload.email) {
            return { success: false, message: "Invalid token payload" };
        }

        return {
            success: true,
            user: {
                email: payload.email,
                googleId: payload.sub,
                firstName: payload.given_name,
                lastName: payload.family_name,
                photo_url: payload.picture,
            }
        };
    } catch (error) {
        return { success: false, message: "Token verification failed" };
    }
}