import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { Survey, CreateSurveyDTO, UpdateSurveyDTO } from '../models/survey';
import { generateSurveyPDF } from '../services/pdfGenerator';
import path from 'path';

const router = Router();

// Get all surveys (for admin)
router.get('/', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    let query = 'SELECT * FROM surveys ORDER BY created_at DESC';
    let params: string[] = [];

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query = 'SELECT * FROM surveys WHERE status = ? ORDER BY created_at DESC';
      params = [status];
    }

    const surveys = db.prepare(query).all(...params) as Array<Survey & { responses: string }>;

    const formattedSurveys = surveys.map(survey => ({
      ...survey,
      responses: JSON.parse(survey.responses)
    }));

    res.json(formattedSurveys);
  } catch (error) {
    console.error('Error fetching surveys:', error);
    res.status(500).json({ error: '설문 목록을 불러오는데 실패했습니다.' });
  }
});

// Get single survey
router.get('/:id', (req: Request, res: Response) => {
  try {
    const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id) as (Survey & { responses: string }) | undefined;

    if (!survey) {
      return res.status(404).json({ error: '설문을 찾을 수 없습니다.' });
    }

    res.json({
      ...survey,
      responses: JSON.parse(survey.responses)
    });
  } catch (error) {
    console.error('Error fetching survey:', error);
    res.status(500).json({ error: '설문을 불러오는데 실패했습니다.' });
  }
});

// Create new survey (customer submission)
router.post('/', (req: Request, res: Response) => {
  try {
    const data: CreateSurveyDTO = req.body;

    // Validation
    if (!data.customer_name || !data.customer_email || !data.responses) {
      return res.status(400).json({ error: '필수 항목을 입력해주세요.' });
    }

    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO surveys (id, customer_name, customer_email, customer_phone, company_name, responses)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.customer_name,
      data.customer_email,
      data.customer_phone || null,
      data.company_name || null,
      JSON.stringify(data.responses)
    );

    res.status(201).json({ id, message: '설문이 성공적으로 제출되었습니다.' });
  } catch (error) {
    console.error('Error creating survey:', error);
    res.status(500).json({ error: '설문 제출에 실패했습니다.' });
  }
});

// Update survey status (admin review)
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: UpdateSurveyDTO = req.body;

    const existing = db.prepare('SELECT * FROM surveys WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '설문을 찾을 수 없습니다.' });
    }

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (data.status) {
      updates.push('status = ?');
      values.push(data.status);
      updates.push('reviewed_at = CURRENT_TIMESTAMP');
    }

    if (data.admin_notes !== undefined) {
      updates.push('admin_notes = ?');
      values.push(data.admin_notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '업데이트할 내용이 없습니다.' });
    }

    values.push(id);
    const query = `UPDATE surveys SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    res.json({ message: '설문이 업데이트되었습니다.' });
  } catch (error) {
    console.error('Error updating survey:', error);
    res.status(500).json({ error: '설문 업데이트에 실패했습니다.' });
  }
});

// Generate PDF document
router.post('/:id/generate-pdf', async (req: Request, res: Response) => {
  try {
    const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id) as (Survey & { responses: string }) | undefined;

    if (!survey) {
      return res.status(404).json({ error: '설문을 찾을 수 없습니다.' });
    }

    const formattedSurvey: Survey = {
      ...survey,
      responses: JSON.parse(survey.responses)
    };

    const pdfPath = await generateSurveyPDF(formattedSurvey);

    // Update document generation timestamp
    db.prepare('UPDATE surveys SET document_generated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

    res.json({
      message: 'PDF 문서가 생성되었습니다.',
      fileName: path.basename(pdfPath)
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'PDF 생성에 실패했습니다.' });
  }
});

// Download PDF
router.get('/:id/download', (req: Request, res: Response) => {
  try {
    const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id) as Survey | undefined;

    if (!survey) {
      return res.status(404).json({ error: '설문을 찾을 수 없습니다.' });
    }

    const documentsDir = path.join(__dirname, '../../documents');
    const files = require('fs').readdirSync(documentsDir);
    const pdfFile = files.find((f: string) => f.startsWith(`survey_${req.params.id}`));

    if (!pdfFile) {
      return res.status(404).json({ error: 'PDF 파일을 찾을 수 없습니다. 먼저 문서를 생성해주세요.' });
    }

    res.download(path.join(documentsDir, pdfFile));
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({ error: 'PDF 다운로드에 실패했습니다.' });
  }
});

// Delete survey
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM surveys WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '설문을 찾을 수 없습니다.' });
    }

    res.json({ message: '설문이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting survey:', error);
    res.status(500).json({ error: '설문 삭제에 실패했습니다.' });
  }
});

// Get statistics
router.get('/stats/overview', (req: Request, res: Response) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM surveys').get() as { count: number };
    const pending = db.prepare("SELECT COUNT(*) as count FROM surveys WHERE status = 'pending'").get() as { count: number };
    const approved = db.prepare("SELECT COUNT(*) as count FROM surveys WHERE status = 'approved'").get() as { count: number };
    const rejected = db.prepare("SELECT COUNT(*) as count FROM surveys WHERE status = 'rejected'").get() as { count: number };

    res.json({
      total: total.count,
      pending: pending.count,
      approved: approved.count,
      rejected: rejected.count
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: '통계를 불러오는데 실패했습니다.' });
  }
});

export default router;
