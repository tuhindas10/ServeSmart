export default function Tag({ tone = 'muted', children }) {
  return (
    <span className={`tag tag-${tone}`} data-tag={children}>
      {children}
    </span>
  )
}
