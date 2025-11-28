import nodemailer from 'nodemailer';

// Configuration du transporteur SMTP avec gestion des certificats
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465, // `true` pour le port 465, `false` pour les autres (comme 587)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // Configuration SSL/TLS améliorée pour gérer les certificats auto-signés
    rejectUnauthorized: false, // Accepter les certificats auto-signés
    ciphers: 'SSLv3', // Chiffrement compatible
  },
  // Options supplémentaires pour la compatibilité
  connectionTimeout: 60000, // 60 secondes
  greetingTimeout: 30000, // 30 secondes
  socketTimeout: 60000, // 60 secondes
});

// Interface pour les options d'email
interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Fonction centrale pour envoyer un e-mail.
 * @param mailOptions - L'objet contenant le destinataire, le sujet et le contenu HTML.
 */
export async function sendMail({ to, subject, html }: MailOptions) {
  const options = {
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  };

  try {
    // Vérifier la connexion avant d'envoyer
    await transporter.verify();
    console.log('Connexion SMTP vérifiée avec succès');
    
    const info = await transporter.sendMail(options);
    console.log('Email envoyé avec succès : %s', info.messageId);
    return info;
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email via Nodemailer:", error);
    
    // Messages d'erreur plus spécifiques
    if (error.code === 'ESOCKET') {
      console.error('Erreur de socket - problème de certificat SSL/TLS');
      throw new Error("Erreur de connexion au serveur email. Vérifiez la configuration SSL.");
    } else if (error.code === 'EAUTH') {
      throw new Error("Erreur d'authentification email. Vérifiez vos identifiants.");
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error("Timeout de connexion email. Le serveur met trop de temps à répondre.");
    } else {
      throw new Error("Impossible d'envoyer l'email.");
    }
  }
}

/**
 * Envoie l'e-mail de vérification de compte.
 * @param to - L'adresse e-mail du nouvel utilisateur.
 * @param code - Le code de vérification à 6 chiffres.
 */
export async function sendVerificationEmail(to: string, code: string) {
  const subject = 'Votre code de vérification pour Shorty';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Bonjour !</h2>
      <p>Merci de vous être inscrit sur Shorty. Veuillez utiliser le code ci-dessous pour vérifier votre compte :</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background-color: #f4f4f4; padding: 10px; border-radius: 5px; text-align: center;">
        ${code}
      </p>
      <p>Ce code expirera dans 10 minutes.</p>
      <p>Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet e-mail.</p>
      <p>L'équipe Shorty</p>
    </div>
  `;
  await sendMail({ to, subject, html });
}

/**
 * Envoie l'e-mail d'invitation à une équipe.
 * @param to - L'adresse e-mail de la personne invitée.
 * @param inviterName - Le nom de la personne qui invite.
 * @param teamName - Le nom de l'équipe.
 * @param token - Le token d'invitation unique.
 */
export async function sendTeamInvitationEmail(to: string, inviterName: string, teamName: string, token: string) {
  const invitationUrl = `${process.env.NEXTAUTH_URL}/team/join?token=${token}`;
  const subject = `Invitation à rejoindre l'équipe ${teamName} sur Shorty`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Bonjour !</h2>
      <p><strong>${inviterName}</strong> vous a invité à rejoindre l'équipe <strong>${teamName}</strong> sur Shorty.</p>
      <p>Cliquez sur le bouton ci-dessous pour accepter l'invitation :</p>
      <a href="${invitationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Accepter l'invitation
      </a>
      <p style="margin-top: 20px;">Ce lien d'invitation expirera dans 7 jours.</p>
      <p>L'équipe Shorty</p>
    </div>
  `;
  await sendMail({ to, subject, html });
}