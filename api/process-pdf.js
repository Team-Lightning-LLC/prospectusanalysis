const formidable = require('formidable');
const fs = require('fs');
const FormData = require('form-data');

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  let tempFilePath = null;

  try {
    console.log('Starting PDF processing...');

    // Parse multipart form data
    const form = formidable({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    console.log('Form parsed successfully');

    // Get the uploaded file
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    
    if (!uploadedFile) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    tempFilePath = uploadedFile.filepath;
    console.log('File received:', {
      name: uploadedFile.originalFilename,
      size: uploadedFile.size,
      type: uploadedFile.mimetype
    });

    // Validate file type
    if (uploadedFile.mimetype !== 'application/pdf') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only PDF files are allowed' 
      });
    }

    // Prepare FormData for n8n
    const formData = new FormData();
    const fileStream = fs.createReadStream(uploadedFile.filepath);
    
    formData.append('file', fileStream, {
      filename: uploadedFile.originalFilename,
      contentType: uploadedFile.mimetype,
    });

    // Get environment variables
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://muinf.app.n8n.cloud/webhook-test/99be3264-ecb1-4abb-910d-85e54e0bb5ed';
    const apiKey = process.env.VERTESIA_API_KEY;

    console.log('Forwarding to n8n...');

    // Forward to n8n webhook
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders(),
        ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
      },
    });

    console.log('n8n response status:', n8nResponse.status);

    let result;
    try {
      result = await n8nResponse.json();
    } catch (e) {
      result = { message: 'Processing completed successfully' };
    }

    // Success response
    res.status(200).json({
      success: true,
      data: result,
      message: 'Document processed successfully',
      filename: uploadedFile.originalFilename,
      size: uploadedFile.size
    });

  } catch (error) {
    console.error('Processing error:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Processing failed', 
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  } finally {
    // Cleanup temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('Temporary file cleaned up');
      } catch (e) {
        console.error('Failed to cleanup temp file:', e);
      }
    }
  }
}
