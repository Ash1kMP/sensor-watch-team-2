import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    auth: {
        user: 'your-email@example.com',
        pass: 'your-email-password',
    },
});

export const sendEmailNotification = async (to: string, subject: string, text: string) => {
    const mailOptions = {
        from: 'your-email@example.com',
        to,
        subject,
        text,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
    }
};