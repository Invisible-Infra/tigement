/**
 * Social Media Sharing Utilities
 * Generate share URLs for various social platforms
 */

const APP_URL = 'https://tigement.com'; // Update with actual domain

export interface ShareOptions {
  couponCode: string;
  monthsGranted?: number;
  customMessage?: string;
}

/**
 * Generate default share message
 */
function getDefaultMessage(options: ShareOptions): string {
  const months = options.monthsGranted || 1;
  return options.customMessage || 
    `Get ${months} month${months > 1 ? 's' : ''} of Tigement Premium! Use my referral code: ${options.couponCode} at ${APP_URL}`;
}

/**
 * Share to Facebook
 */
export function shareToFacebook(options: ShareOptions): void {
  const message = getDefaultMessage(options);
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_URL)}&quote=${encodeURIComponent(message)}`;
  
  window.open(url, '_blank', 'width=600,height=400');
}

/**
 * Share to Twitter/X
 */
export function shareToTwitter(options: ShareOptions): void {
  const message = getDefaultMessage(options);
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
  
  window.open(url, '_blank', 'width=600,height=400');
}

/**
 * Share to Threads
 */
export function shareToThreads(options: ShareOptions): void {
  const message = getDefaultMessage(options);
  // Threads doesn't have a direct sharing API yet, so we use the text parameter
  // This will open Threads app or web with pre-filled text
  const url = `https://www.threads.net/intent/post?text=${encodeURIComponent(message)}`;
  
  window.open(url, '_blank', 'width=600,height=400');
}

/**
 * Share to LinkedIn
 */
export function shareToLinkedIn(options: ShareOptions): void {
  const message = getDefaultMessage(options);
  const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(APP_URL + '?ref=' + options.couponCode)}`;
  
  window.open(url, '_blank', 'width=600,height=400');
}

/**
 * Share to WhatsApp
 */
export function shareToWhatsApp(options: ShareOptions): void {
  const message = getDefaultMessage(options);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  
  window.open(url, '_blank');
}

/**
 * Share to Telegram
 */
export function shareToTelegram(options: ShareOptions): void {
  const message = getDefaultMessage(options);
  const url = `https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(message)}`;
  
  window.open(url, '_blank');
}

/**
 * Share via email
 */
export function shareViaEmail(options: ShareOptions): void {
  const message = getDefaultMessage(options);
  const subject = `Get Tigement Premium - ${options.couponCode}`;
  const body = `${message}\n\nTigement is a powerful task management and productivity app. Try it now!`;
  
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

/**
 * Copy coupon code to clipboard
 */
export async function copyCouponCode(couponCode: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(couponCode);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = couponCode;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (err) {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

/**
 * Use native share API if available (mobile devices)
 */
export async function shareNative(options: ShareOptions): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  try {
    await navigator.share({
      title: 'Tigement Premium Referral',
      text: getDefaultMessage(options),
      url: APP_URL,
    });
    return true;
  } catch (error) {
    // User canceled or share failed
    return false;
  }
}

/**
 * Get all available share methods
 */
export function getAvailableShareMethods(): string[] {
  const methods = [
    'facebook',
    'twitter',
    'threads',
    'linkedin',
    'whatsapp',
    'telegram',
    'email',
    'copy'
  ];

  if (navigator.share) {
    methods.unshift('native');
  }

  return methods;
}

