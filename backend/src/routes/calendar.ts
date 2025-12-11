import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db';
import { authMiddleware, AuthRequest, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

// Generate iCal token for calendar sharing (premium only)
router.post('/token', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user has premium subscription
    const subResult = await query(
      'SELECT plan FROM subscriptions WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (subResult.rows.length === 0 || subResult.rows[0].plan !== 'premium') {
      return res.status(403).json({ error: 'Premium subscription required' });
    }
    
    // Check if token already exists
    const existingToken = await query(
      'SELECT token FROM ical_tokens WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (existingToken.rows.length > 0) {
      return res.json({ token: existingToken.rows[0].token });
    }
    
    // Generate new token
    const token = crypto.randomBytes(32).toString('hex');
    
    await query(
      'INSERT INTO ical_tokens (user_id, token) VALUES ($1, $2)',
      [req.user!.id, token]
    );
    
    res.json({ token });
  } catch (error) {
    console.error('Generate iCal token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get iCal feed (public endpoint with token)
router.get('/:token/feed.ics', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Get user by token
    const tokenResult = await query(
      'SELECT user_id FROM ical_tokens WHERE token = $1',
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid token' });
    }
    
    const userId = tokenResult.rows[0].user_id;
    
    // Get workspace data
    const workspaceResult = await query(
      'SELECT encrypted_data FROM workspaces WHERE user_id = $1',
      [userId]
    );
    
    if (workspaceResult.rows.length === 0) {
      // Return empty calendar
      const icalContent = generateEmptyICal();
      res.set('Content-Type', 'text/calendar');
      return res.send(icalContent);
    }
    
    // TODO: Decrypt and parse workspace data to generate iCal events
    // For now, return a placeholder
    const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tigement//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Tigement Schedule
X-WR-TIMEZONE:UTC
X-WR-CALDESC:Your Tigement schedule
BEGIN:VEVENT
UID:example@tigement.com
DTSTAMP:${formatICalDate(new Date())}
DTSTART:${formatICalDate(new Date())}
DTEND:${formatICalDate(new Date(Date.now() + 3600000))}
SUMMARY:Sample Task
DESCRIPTION:This is a placeholder. Sync your data to see your schedule.
END:VEVENT
END:VCALENDAR`;
    
    res.set('Content-Type', 'text/calendar');
    res.send(icalContent);
  } catch (error) {
    console.error('Get iCal feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function generateEmptyICal(): string {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tigement//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Tigement Schedule
X-WR-TIMEZONE:UTC
END:VCALENDAR`;
}

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export default router;

