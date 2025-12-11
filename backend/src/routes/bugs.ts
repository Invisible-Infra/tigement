import { Router } from 'express';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { optionalAuthMiddleware, AuthRequest } from '../middleware/auth';
import { getTransporter } from '../services/email';

const router = Router();

// Apply optional auth middleware - allow anonymous bug reports
router.use(optionalAuthMiddleware);

const bugReportSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  severity: z.enum(['Normal', 'Severe', 'Critical']),
  githubHandle: z.string().optional(),
  postAnonymously: z.boolean().optional(),
  logs: z.string().optional(),
});

const featureRequestSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['Nice to have', 'Need', 'Just an idea']),
  githubHandle: z.string().optional(),
  name: z.string().optional(),
  postAnonymously: z.boolean().optional(),
});

// Helper function to send email to admin
async function sendAdminEmail(subject: string, body: string) {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  if (adminEmails.length === 0) {
    console.warn('No admin emails configured, skipping email notification');
    return;
  }

  try {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
      from: `"Tigement" <${from}>`,
      to: adminEmails.join(', '),
      subject,
      html: body.replace(/\n/g, '<br>'),
      text: body,
    });

    console.log(`✅ Admin email sent: ${subject}`);
  } catch (error) {
    console.error('Failed to send admin email:', error);
    // Don't throw - email failure shouldn't block issue creation
  }
}

// Helper function to create GitHub issue
async function createGitHubIssue(
  title: string,
  body: string,
  labels: string[]
): Promise<{ success: boolean; issueUrl?: string; error?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    return { success: false, error: 'GitHub integration not configured' };
  }

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    return { success: false, error: 'Invalid GITHUB_REPO format. Expected: owner/repo' };
  }

  try {
    const octokit = new Octokit({ auth: token });

    const response = await octokit.rest.issues.create({
      owner,
      repo: repoName,
      title,
      body,
      labels,
    });

    return {
      success: true,
      issueUrl: response.data.html_url,
    };
  } catch (error: any) {
    console.error('Failed to create GitHub issue:', error);
    return {
      success: false,
      error: error.message || 'Failed to create GitHub issue',
    };
  }
}

// Report bug
router.post('/report', async (req: AuthRequest, res) => {
  try {
    const { description, severity, githubHandle, postAnonymously, logs } = bugReportSchema.parse(req.body);
    const user = req.user;

    // Create issue body
    let issueBody = `## Bug Report

**Description:**
${description}

**Severity:** ${severity}
`;

    // Only include "Reported by" if not posting anonymously and user is logged in
    if (!postAnonymously && user) {
      issueBody += `\n**Reported by:** ${user.email}${githubHandle ? ` (@${githubHandle})` : ''}\n`;
    }

    issueBody += `\n**Reported at:** ${new Date().toISOString()}\n`;

    // Append console logs if provided
    if (logs) {
      issueBody += `\n---\n\n<details>\n<summary>Console Logs (Anonymized)</summary>\n\n\`\`\`\n${logs}\n\`\`\`\n\n</details>\n`;
    }

    // Send email to admin
    const emailSubject = `🐛 Bug Report: ${severity} - ${description.substring(0, 50)}...`;
    const emailBody = `A new bug report has been submitted:

${issueBody}

---
This is an automated notification from Tigement.`;

    await sendAdminEmail(emailSubject, emailBody);

    // Create GitHub issue
    const labels = severity === 'Critical' ? ['bug', 'critical'] : severity === 'Severe' ? ['bug', 'severe'] : ['bug'];
    const githubResult = await createGitHubIssue(
      `[Bug] ${description.substring(0, 60)}${description.length > 60 ? '...' : ''}`,
      issueBody,
      labels
    );

    if (!githubResult.success) {
      console.warn('GitHub issue creation failed:', githubResult.error);
      // Still return success if email was sent
    }

    res.json({
      success: true,
      message: 'Bug report submitted successfully',
      githubIssueUrl: githubResult.issueUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Bug report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Feature request
router.post('/feature-request', async (req: AuthRequest, res) => {
  try {
    const { description, priority, githubHandle, name, postAnonymously } = featureRequestSchema.parse(req.body);
    const user = req.user;

    // Create issue body
    let issueBody = `## Feature Request

**Description:**
${description}

**Priority:** ${priority}

${name ? `**Feature Name:** ${name}\n` : ''}`;

    // Only include "Requested by" if not posting anonymously and user is logged in
    if (!postAnonymously && user) {
      issueBody += `**Requested by:** ${user.email}${githubHandle ? ` (@${githubHandle})` : ''}\n\n`;
    }

    issueBody += `**Requested at:** ${new Date().toISOString()}\n`;

    // Send email to admin
    const emailSubject = `✨ Feature Request: ${priority} - ${name || description.substring(0, 50)}...`;
    const emailBody = `A new feature request has been submitted:

${issueBody}

---
This is an automated notification from Tigement.`;

    await sendAdminEmail(emailSubject, emailBody);

    // Create GitHub issue
    const labels = ['enhancement', priority.toLowerCase().replace(/\s+/g, '-')];
    const issueTitle = name
      ? `[Feature] ${name}`
      : `[Feature] ${description.substring(0, 60)}${description.length > 60 ? '...' : ''}`;

    const githubResult = await createGitHubIssue(issueTitle, issueBody, labels);

    if (!githubResult.success) {
      console.warn('GitHub issue creation failed:', githubResult.error);
      // Still return success if email was sent
    }

    res.json({
      success: true,
      message: 'Feature request submitted successfully',
      githubIssueUrl: githubResult.issueUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Feature request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

