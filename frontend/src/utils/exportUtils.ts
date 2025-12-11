/**
 * Export diary entry to markdown file
 * @param date - Date string in YYYY-MM-DD format
 * @param content - Markdown content to export
 */
export function exportDiaryToMarkdown(date: string, content: string): void {
  try {
    // Create filename: diary-YYYY-MM-DD.md
    const filename = `diary-${date}.md`
    
    // Create blob with markdown content
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    
    // Create download link
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    
    // Trigger download
    document.body.appendChild(link)
    link.click()
    
    // Cleanup
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export diary entry:', error)
    alert('Failed to export diary entry. Please try again.')
  }
}

