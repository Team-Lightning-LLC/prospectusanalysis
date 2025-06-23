export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Only POST allowed' });
    }

    try {
        const formData = new FormData();
        const file = req.body; // or req.file depending on middleware

        // Re-attach file to formData
        formData.append('file', file);

        const response = await fetch('https://muinf.app.n8n.cloud/webhook-test/99be3264-ecb1-4abb-910d-85e54e0bb5ed', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.Vertesia}`
            },
            body: formData
        });

        const result = await response.json();
        res.status(200).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to process PDF' });
    }
}
