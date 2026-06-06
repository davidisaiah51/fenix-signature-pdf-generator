# Fenix Linn Signature PDF Generator

This is a tiny Vercel serverless endpoint that generates the customized cursive signature worksheet as a real HTTPS PDF response.

Endpoint after deploy:

`https://YOUR-VERCEL-PROJECT.vercel.app/api/signature-pdf`

It accepts a POST request with:

- `childName`

It returns:

- `Content-Type: application/pdf`
- `Content-Disposition: attachment`

The endpoint does not save names, PDFs, or form submissions.
