import PDFDocument from 'pdfkit';
import { Survey } from '../models/survey';
import path from 'path';
import fs from 'fs';

const outputDir = path.join(__dirname, '../../documents');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

export function generateSurveyPDF(survey: Survey): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileName = `survey_${survey.id}_${Date.now()}.pdf`;
    const filePath = path.join(outputDir, fileName);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Title
    doc.fontSize(24).text('설문 응답 보고서', { align: 'center' });
    doc.moveDown(2);

    // Customer Information Section
    doc.fontSize(16).fillColor('#2563eb').text('고객 정보', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#000000');
    doc.text(`이름: ${survey.customer_name}`);
    doc.text(`이메일: ${survey.customer_email}`);
    if (survey.customer_phone) {
      doc.text(`전화번호: ${survey.customer_phone}`);
    }
    if (survey.company_name) {
      doc.text(`회사명: ${survey.company_name}`);
    }
    doc.moveDown(1.5);

    // Survey Status
    doc.fontSize(16).fillColor('#2563eb').text('설문 상태', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#000000');
    const statusText = {
      pending: '검토 대기',
      approved: '승인됨',
      rejected: '반려됨'
    };
    doc.text(`상태: ${statusText[survey.status]}`);
    doc.text(`제출일: ${new Date(survey.created_at).toLocaleDateString('ko-KR')}`);
    if (survey.reviewed_at) {
      doc.text(`검토일: ${new Date(survey.reviewed_at).toLocaleDateString('ko-KR')}`);
    }
    doc.moveDown(1.5);

    // Survey Responses Section
    doc.fontSize(16).fillColor('#2563eb').text('설문 응답', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#000000');

    survey.responses.forEach((response, index) => {
      doc.font('Helvetica-Bold').text(`Q${index + 1}. ${response.question}`);
      doc.font('Helvetica').text(`A. ${response.answer}`);
      doc.moveDown(0.8);
    });

    // Admin Notes (if any)
    if (survey.admin_notes) {
      doc.moveDown(1);
      doc.fontSize(16).fillColor('#2563eb').text('관리자 메모', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#000000').text(survey.admin_notes);
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#666666').text(
      `문서 생성일: ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}`,
      { align: 'center' }
    );

    doc.end();

    stream.on('finish', () => {
      resolve(filePath);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

export function getPDFPath(fileName: string): string {
  return path.join(outputDir, fileName);
}
