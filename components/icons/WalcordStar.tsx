export default function WalcordStar({
  filled,
  size = 24,
  className = '',
}: {
  filled: boolean
  size?: number
  className?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={filled ? '#1F48AF' : 'none'}
      viewBox="0 0 24 24"
      stroke={filled ? '#1F48AF' : 'gray'}
      className={className}
      width={size}
      height={size}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M11.48 3.499a.562.562 0 011.04 0l2.1 5.008a.562.562 0 00.475.347l5.39.497a.562.562 0 01.316.985l-4.073 3.662a.562.562 0 00-.175.525l1.198 5.294a.562.562 0 01-.84.6l-4.604-2.725a.562.562 0 00-.562 0l-4.604 2.725a.562.562 0 01-.84-.6l1.199-5.294a.562.562 0 00-.175-.525L2.2 10.336a.562.562 0 01.316-.985l5.39-.497a.562.562 0 00.475-.347l2.1-5.008z"
      />
    </svg>
  )
}