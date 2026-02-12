import nodemailer from 'nodemailer';
import { ENV } from '../config/env.js';


const EMAIL_USER = ENV.EMAIL_USER;
const EMAIL_PASS = ENV.EMAIL_PASS;

// Create a transporter object using SMTP transport
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});
