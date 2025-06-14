# Setup Guide

This guide will walk you through setting up Cloud Transcripts from scratch.

## Prerequisites

Before you begin, ensure you have the following:

- **Node.js** 18.0 or higher
- **npm** or **yarn** package manager
- **Python** 3.11 or higher
- **Git** for version control
- **Modal CLI** (`pip install modal`)
- Active accounts for:
  - [AWS](https://aws.amazon.com) (with S3 access)
  - [Supabase](https://supabase.com)
  - [Modal](https://modal.com)
  - [Hugging Face](https://huggingface.co) (for speaker diarization)

## Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/cloud-transcripts.git
cd cloud-transcripts
```

## Step 2: Install Dependencies

Install all Node.js dependencies:

```bash
npm install
```

This will install dependencies for all workspaces (web app, packages).

## Step 3: Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your credentials:

### Supabase Configuration

1. Create a new Supabase project at [app.supabase.com](https://app.supabase.com)
2. Go to Settings → API
3. Copy the following values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

### AWS S3 Configuration

1. Create an S3 bucket in your AWS account
2. Create an IAM user with S3 access
3. Generate access keys and add them:
   ```env
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_REGION=us-east-1
   S3_BUCKET=your-bucket-name
   ```

### S3 Bucket Policy

Add this bucket policy to allow presigned URL uploads:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPresignedUploads",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/YOUR_IAM_USER"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### Modal Configuration

1. Sign up for Modal at [modal.com](https://modal.com)
2. Install Modal CLI:
   ```bash
   pip install modal
   ```
3. Authenticate:
   ```bash
   modal token new
   ```
4. Create a secret in Modal dashboard named `transcript-worker-secret` with:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_DEFAULT_REGION`
   - `HF_TOKEN` (Hugging Face token)
   - `WEBHOOK_SECRET` (generate a random string)
   - `WEBHOOK_URL` (will be set after deployment)

### Webhook Configuration

Generate a secure webhook secret:
```bash
openssl rand -hex 32
```

Add to `.env`:
```env
WEBHOOK_SECRET=your-generated-secret
WEBHOOK_URL=https://your-domain.com/api/webhook/modal
```

Note: For local development, you'll need to use a tool like ngrok to expose your webhook endpoint.

### Hugging Face Token

1. Sign up at [huggingface.co](https://huggingface.co)
2. Go to Settings → Access Tokens
3. Create a new token with read access
4. Add to Modal secret as `HF_TOKEN`

## Step 4: Database Setup

### Initialize Supabase

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link to your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Apply migrations:
   ```bash
   supabase db push
   ```

### Manual Migration (Alternative)

If you prefer, you can run the migration manually:

1. Go to Supabase SQL Editor
2. Run the migration from `infra/supabase/migrations/001_initial_schema.sql`

## Step 5: Deploy Modal Worker

1. Navigate to the worker directory:
   ```bash
   cd apps/worker
   ```

2. Deploy to Modal:
   ```bash
   modal deploy main.py
   ```

3. Note the endpoint URL (e.g., `https://username--app-name-enqueue.modal.run`)

4. Update your `.env` file:
   ```env
   MODAL_QUEUE_URL=https://username--app-name-enqueue.modal.run
   ```

5. Update the Modal secret with the correct `WEBHOOK_URL`

## Step 6: Run the Application

### Development Mode

Start the development server:

```bash
npm run dev
```

The application will be available at:
- Web app: [http://localhost:3000](http://localhost:3000)

### Production Build

Build for production:

```bash
npm run build
npm run start
```

## Step 7: Verify Setup

1. **Test File Upload**:
   - Navigate to http://localhost:3000
   - Try uploading a small audio/video file
   - Verify it uploads to S3

2. **Test Worker**:
   - Check Modal dashboard for job execution
   - Monitor logs for any errors

3. **Test Database**:
   - Check Supabase dashboard for new records
   - Verify real-time updates work

## Troubleshooting

### Common Issues

#### CORS Errors
If you get CORS errors during upload:
1. Check S3 bucket CORS configuration
2. Add this CORS policy to your bucket:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

#### Modal Worker Not Receiving Jobs
1. Check the `MODAL_QUEUE_URL` is correct
2. Verify Modal secret contains all required environment variables
3. Check Modal logs for errors

#### Database Connection Issues
1. Verify Supabase credentials are correct
2. Check if RLS policies are properly configured
3. Ensure service role key is used for webhook endpoint

#### Webhook Failures
1. Verify `WEBHOOK_SECRET` matches in both `.env` and Modal secret
2. Check webhook URL includes the full path (`/api/webhook/modal`)
3. For local development, use ngrok:
   ```bash
   ngrok http 3000
   ```
   Then update `WEBHOOK_URL` with the ngrok URL

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

## Next Steps

- Read the [API Documentation](./api.md) to understand the endpoints
- Review [Worker Documentation](./worker.md) for processing details
- Check [Deployment Guide](./deployment.md) for production setup
- See [Contributing Guidelines](./contributing.md) to contribute 