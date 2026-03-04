const express = require('express');
const cors = require('cors');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

// Directories
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');

[UPLOADS_DIR, DATA_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});
if (!fs.existsSync(APPLICATIONS_FILE)) fs.writeFileSync(APPLICATIONS_FILE, '[]');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Multer storage ────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'image/gif',
  'image/webp',
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only JPEG, PNG, PDF, GIF, and WEBP are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function readApplications() {
  const raw = fs.readFileSync(APPLICATIONS_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeApplications(apps) {
  fs.writeFileSync(APPLICATIONS_FILE, JSON.stringify(apps, null, 2));
}

// ── Application routes ────────────────────────────────────────────────────────
app.get('/api/applications', (_req, res) => {
  res.json(readApplications());
});

app.get('/api/applications/:id', (req, res) => {
  const app_ = readApplications().find((a) => a.id === req.params.id);
  if (!app_) return res.status(404).json({ error: 'Application not found' });
  res.json(app_);
});

app.post('/api/applications', (req, res) => {
  const apps = readApplications();
  const newApp = {
    id: uuidv4(),
    submittedAt: new Date().toISOString(),
    status: 'pending',
    ...req.body,
  };
  apps.push(newApp);
  writeApplications(apps);
  res.status(201).json(newApp);
});

app.patch('/api/applications/:id/status', (req, res) => {
  const apps = readApplications();
  const idx = apps.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Application not found' });
  const { status } = req.body;
  const VALID = ['pending', 'under_review', 'approved', 'denied'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  apps[idx].status = status;
  apps[idx].updatedAt = new Date().toISOString();
  writeApplications(apps);
  res.json(apps[idx]);
});

// ── Document upload routes ────────────────────────────────────────────────────
app.post('/api/documents/upload', upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const uploaded = req.files.map((f) => ({
    filename: f.filename,
    originalName: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
    url: `/uploads/${f.filename}`,
    uploadedAt: new Date().toISOString(),
    category: req.body.category || 'general',
    applicationId: req.body.applicationId || null,
  }));

  // Persist document metadata alongside the application if an id is provided
  if (req.body.applicationId) {
    const apps = readApplications();
    const idx = apps.findIndex((a) => a.id === req.body.applicationId);
    if (idx !== -1) {
      apps[idx].documents = [...(apps[idx].documents || []), ...uploaded];
      writeApplications(apps);
    }
  }

  res.status(201).json({ files: uploaded });
});

// ── PDF generation routes ─────────────────────────────────────────────────────
function buildApplicationPDF(doc, data) {
  const {
    firstName = '',
    lastName = '',
    email = '',
    phone = '',
    dateOfBirth = '',
    currentAddress = '',
    city = '',
    state = '',
    zip = '',
    employer = '',
    position = '',
    monthlyIncome = '',
    employmentLength = '',
    previousLandlord = '',
    previousLandlordPhone = '',
    reference1Name = '',
    reference1Phone = '',
    reference2Name = '',
    reference2Phone = '',
    pets = 'No',
    vehicles = '',
    additionalInfo = '',
    submittedAt = new Date().toISOString(),
  } = data;

  doc.fontSize(20).text('RENTAL APPLICATION', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Date: ${new Date(submittedAt).toLocaleDateString()}`, { align: 'right' });
  doc.moveDown();

  const section = (title) => {
    doc.moveDown(0.5);
    doc.fontSize(13).fillColor('#1a3a5c').text(title);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke('#1a3a5c');
    doc.fillColor('black').fontSize(11).moveDown(0.4);
  };

  const row = (label, value) => {
    doc.text(`${label}: `, { continued: true }).font('Helvetica-Bold').text(String(value || '—')).font('Helvetica');
  };

  section('Personal Information');
  row('Full Name', `${firstName} ${lastName}`);
  row('Date of Birth', dateOfBirth);
  row('Email', email);
  row('Phone', phone);

  section('Current Address');
  row('Street', currentAddress);
  row('City / State / Zip', `${city}, ${state} ${zip}`);

  section('Employment & Income');
  row('Employer', employer);
  row('Position', position);
  row('Monthly Income', monthlyIncome ? `$${monthlyIncome}` : '—');
  row('Length of Employment', employmentLength);

  section('Rental History');
  row('Previous Landlord', previousLandlord);
  row('Previous Landlord Phone', previousLandlordPhone);

  section('References');
  row('Reference 1', `${reference1Name} — ${reference1Phone}`);
  row('Reference 2', `${reference2Name} — ${reference2Phone}`);

  section('Additional Information');
  row('Pets', pets);
  row('Vehicles', vehicles);
  if (additionalInfo) {
    doc.moveDown(0.3).text('Notes:').text(additionalInfo);
  }

  doc.moveDown(2);
  doc.fontSize(10).fillColor('#555').text(
    'I certify that all information provided is true and complete to the best of my knowledge.',
  );
  doc.moveDown(2);
  doc.text('Applicant Signature: ________________________   Date: ___________');
}

function buildLeaseAgreementPDF(doc, data) {
  const {
    firstName = '',
    lastName = '',
    propertyAddress = 'TBD',
    rentAmount = '',
    leaseStartDate = '',
    leaseEndDate = '',
    securityDeposit = '',
    landlordName = 'Leasing Agency',
  } = data;

  doc.fontSize(20).text('RESIDENTIAL LEASE AGREEMENT', { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).text(
    `This Residential Lease Agreement ("Agreement") is entered into as of ${new Date().toLocaleDateString()} by and between ${landlordName} ("Landlord") and ${firstName} ${lastName} ("Tenant").`,
  );
  doc.moveDown();

  const section = (title) => {
    doc.moveDown(0.5);
    doc.fontSize(13).fillColor('#1a3a5c').text(title);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke('#1a3a5c');
    doc.fillColor('black').fontSize(11).moveDown(0.4);
  };

  section('1. PREMISES');
  doc.text(`Landlord hereby leases to Tenant the premises located at: ${propertyAddress}`);

  section('2. TERM');
  doc.text(`The lease term begins on ${leaseStartDate || '___________'} and ends on ${leaseEndDate || '___________'}.`);

  section('3. RENT');
  doc.text(`Tenant agrees to pay $${rentAmount || '___'}/month, due on the 1st of each month. A late fee of $50 applies after a 5-day grace period.`);

  section('4. SECURITY DEPOSIT');
  doc.text(`A security deposit of $${securityDeposit || '___'} is required prior to move-in and will be held per applicable state law.`);

  section('5. UTILITIES');
  doc.text('Tenant is responsible for all utilities unless otherwise agreed in writing.');

  section('6. MAINTENANCE');
  doc.text('Tenant shall maintain the premises in a clean and sanitary condition. Tenant shall promptly notify Landlord of any damage or needed repairs.');

  section('7. PETS');
  doc.text('No pets are permitted without prior written consent from Landlord and payment of an additional pet deposit.');

  section('8. TERMINATION');
  doc.text('Either party may terminate this Agreement with 30 days written notice prior to the end of the lease term.');

  section('9. GOVERNING LAW');
  doc.text('This Agreement shall be governed by the laws of the applicable state.');

  doc.moveDown(3);
  doc.fontSize(10).text('Landlord Signature: ________________________   Date: ___________');
  doc.moveDown();
  doc.text('Tenant Signature: __________________________   Date: ___________');
}

function buildMoveInChecklistPDF(doc, data) {
  const { propertyAddress = 'TBD', firstName = '', lastName = '' } = data;

  doc.fontSize(20).text('MOVE-IN / MOVE-OUT CHECKLIST', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Property: ${propertyAddress}`);
  doc.text(`Tenant: ${firstName} ${lastName}`);
  doc.text(`Date: ${new Date().toLocaleDateString()}`);
  doc.moveDown();

  const rooms = [
    'Living Room',
    'Kitchen',
    'Bathroom',
    'Bedroom 1',
    'Bedroom 2',
    'Hallway',
    'Garage / Parking',
    'Exterior',
  ];

  const items = ['Walls', 'Floors', 'Windows', 'Doors', 'Lights', 'Outlets', 'Fixtures'];

  rooms.forEach((room) => {
    doc.fontSize(13).fillColor('#1a3a5c').text(room);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke('#1a3a5c');
    doc.fillColor('black').fontSize(10).moveDown(0.3);
    items.forEach((item) => {
      doc.text(`  ${item}:   Move-In Condition: ______________________   Move-Out Condition: ______________________`);
    });
    doc.moveDown(0.5);
  });

  doc.moveDown(2);
  doc.fontSize(10).text('Tenant Signature: ________________________   Date: ___________');
  doc.moveDown();
  doc.text('Landlord Signature: ______________________   Date: ___________');
}

app.post('/api/documents/generate/:type', (req, res) => {
  const { type } = req.params;
  const VALID_TYPES = ['application', 'lease', 'checklist'];
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid document type' });
  }

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-${Date.now()}.pdf"`);
  doc.pipe(res);

  try {
    if (type === 'application') buildApplicationPDF(doc, req.body);
    else if (type === 'lease') buildLeaseAgreementPDF(doc, req.body);
    else if (type === 'checklist') buildMoveInChecklistPDF(doc, req.body);
  } finally {
    doc.end();
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
