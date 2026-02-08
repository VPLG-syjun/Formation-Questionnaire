import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 환경 변수 확인
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'RESEND_API_KEY is not configured',
      env_check: {
        RESEND_API_KEY: 'NOT SET',
      }
    });
  }

  try {
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: 'FirstRegister <onboarding@resend.dev>',
      to: 'info@firstregister.us',
      subject: '[테스트] FirstRegister 이메일 발송 테스트',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
          <h2>이메일 발송 테스트</h2>
          <p>이 메일이 도착했다면 이메일 설정이 정상입니다.</p>
          <p>발송 시간: ${new Date().toISOString()}</p>
          <hr />
          <p style="color: #666; font-size: 12px;">
            API Key 앞 10자: ${apiKey.substring(0, 10)}...
          </p>
        </div>
      `,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: error,
        api_key_prefix: apiKey.substring(0, 10) + '...',
      });
    }

    return res.status(200).json({
      success: true,
      message: '테스트 이메일이 발송되었습니다.',
      data: data,
      api_key_prefix: apiKey.substring(0, 10) + '...',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || String(error),
      api_key_prefix: apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET',
    });
  }
}
