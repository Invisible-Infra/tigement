/**
 * Markdown formatting toolbar
 * Provides quick access to common markdown formatting for users unfamiliar with markdown syntax
 */

interface MarkdownToolbarProps {
  onInsert: (before: string, after: string, placeholder?: string) => void
}

export function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  const buttons = [
    { label: 'B', title: 'Bold', before: '**', after: '**', placeholder: 'bold text', style: 'font-bold' },
    { label: 'I', title: 'Italic', before: '_', after: '_', placeholder: 'italic text', style: 'italic' },
    { label: 'H1', title: 'Heading 1', before: '# ', after: '', placeholder: 'heading', style: '' },
    { label: 'H2', title: 'Heading 2', before: '## ', after: '', placeholder: 'heading', style: '' },
    { label: '•', title: 'Bullet List', before: '- ', after: '', placeholder: 'list item', style: '' },
    { label: '1.', title: 'Numbered List', before: '1. ', after: '', placeholder: 'list item', style: '' },
    { label: '☐', title: 'Checkbox', before: '- [ ] ', after: '', placeholder: 'task', style: '' },
    { label: 'Link', title: 'Link', before: '[', after: '](url)', placeholder: 'link text', style: '' },
    { label: '</>',title: 'Code Block', before: '```\n', after: '\n```', placeholder: 'code', style: '' },
    { label: '---', title: 'Horizontal Line', before: '\n---\n', after: '', placeholder: '', style: '' },
  ]

  return (
    <div className="flex gap-1 mb-2 flex-wrap">
      {buttons.map(btn => (
        <button
          key={btn.label}
          onClick={(e) => {
            e.preventDefault()
            onInsert(btn.before, btn.after, btn.placeholder)
          }}
          type="button"
          title={btn.title}
          className={`px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 active:bg-gray-200 transition ${btn.style}`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

