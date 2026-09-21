import { motion } from "framer-motion";

/** 부캉이 마스코트. 단순한 형태, 하늘색 계열. */
export default function Shark({ className = "", size = 120, swim = true }: { className?: string; size?: number; swim?: boolean }) {
  return (
    <motion.svg
      className={className}
      width={size}
      height={size * 0.62}
      viewBox="0 0 200 124"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      animate={swim ? { y: [0, -4, 0, 3, 0], rotate: [0, -1.5, 0, 1.5, 0] } : undefined}
      transition={swim ? { duration: 4.5, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      {/* 꼬리 */}
      <path d="M150 62 L192 30 L182 62 L192 94 Z" fill="#8fd3f1" />
      {/* 몸통 */}
      <path d="M20 66 C40 30, 110 22, 160 62 C110 100, 40 96, 20 66 Z" fill="#a9def7" />
      {/* 배 */}
      <path d="M34 70 C60 88, 110 90, 152 66 C110 84, 60 84, 34 70 Z" fill="#ffffff" opacity="0.85" />
      {/* 등지느러미 */}
      <path d="M92 36 L112 6 L126 40 Z" fill="#8fd3f1" />
      {/* 가슴지느러미 */}
      <path d="M78 74 L64 100 L100 82 Z" fill="#8fd3f1" />
      {/* 눈 */}
      <circle cx="46" cy="58" r="6" fill="#0f2a3a" />
      <circle cx="48" cy="56" r="2" fill="#ffffff" />
      {/* 입 */}
      <path d="M28 70 Q40 76 52 70" stroke="#0f2a3a" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* 아가미 */}
      <path d="M70 52 q3 8 0 16 M76 50 q3 10 0 20" stroke="#8fd3f1" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </motion.svg>
  );
}
