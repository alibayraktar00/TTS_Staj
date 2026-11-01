const nodemailer = require('nodemailer');

// Ticket durumu DB'de İngilizce enum olarak tutulur (open/pending/...);
// mail içeriğinde her zaman Türkçe karşılığı gösterilir.
const STATUS_LABELS = {
  open:        'Açık',
  in_progress: 'İşlemde',
  pending:     'Beklemede',
  resolved:    'Çözüldü',
};
const statusLabel = (status) => STATUS_LABELS[status] || status;

// Gmail SMTP — normal hesap şifresi değil, Uygulama Şifresi (App Password) kullanılır
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Tek mail gönderme fonksiyonu — hata fırlatmaz, sadece loglar.
// Mail sunucusu çökse bile talep oluşturma akışı bundan etkilenmemeli.
async function sendMail({ to, subject, html }) {
  if (!to) return;
  try {
    await transporter.sendMail({
      from: `"TTS" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(`Mail gönderilemedi (${to}):`, err.message);
  }
}

function ticketCreatedUserMail(ticket, to) {
  return sendMail({
    to,
    subject: `Talebiniz oluşturuldu — #${ticket.id}`,
    html: `
      <p>Merhaba,</p>
      <p><strong>${ticket.title}</strong> başlıklı talebiniz sisteme kaydedildi.</p>
      <p>Talep No: #${ticket.id}<br>Kategori: ${ticket.kategori}<br>Durum: ${statusLabel(ticket.status)}</p>
      <p>Talebinizin durumunu sistem üzerinden takip edebilirsiniz.</p>
    `,
  });
}

function ticketCreatedManagerMail(ticket, to) {
  return sendMail({
    to,
    subject: `Onayınızı bekleyen yeni bir talep var — #${ticket.id}`,
    html: `
      <p>Merhaba,</p>
      <p><strong>${ticket.kullanici}</strong> tarafından açılan <strong>${ticket.title}</strong> başlıklı talep onayınızı bekliyor.</p>
      <p>Talep No: #${ticket.id}<br>Kategori: ${ticket.kategori}</p>
      <p>Lütfen sistem üzerinden inceleyip onaylayın veya reddedin.</p>
    `,
  });
}

function ticketCreatedAdminMail(ticket, to) {
  return sendMail({
    to,
    subject: `Yeni talep oluşturuldu — #${ticket.id}`,
    html: `
      <p>Merhaba,</p>
      <p><strong>${ticket.kullanici}</strong> tarafından <strong>${ticket.title}</strong> başlıklı yeni bir talep oluşturuldu.</p>
      <p>Talep No: #${ticket.id}<br>Kategori: ${ticket.kategori}<br>Durum: ${statusLabel(ticket.status)}</p>
    `,
  });
}

function ticketAssignedSubAdminMail(ticket, to) {
  return sendMail({
    to,
    subject: `Size yeni bir talep atandı — #${ticket.id}`,
    html: `
      <p>Merhaba,</p>
      <p><strong>${ticket.title}</strong> başlıklı talep size atandı.</p>
      <p>Talep No: #${ticket.id}<br>Kategori: ${ticket.kategori}<br>Talep Eden: ${ticket.kullanici}</p>
      <p>Talebi sistem üzerinden inceleyip işleme alabilirsiniz.</p>
    `,
  });
}

module.exports = {
  sendMail,
  ticketCreatedUserMail,
  ticketCreatedManagerMail,
  ticketCreatedAdminMail,
  ticketAssignedSubAdminMail,
};
