import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -10,
  },
};

const pageTransition = {
  type: "tween",
  ease: "easeOut",
  duration: 0.2,
};

export const PageTransition = ({ children }: PageTransitionProps) => {
  const router = useRouter();
  
  // Use pathname instead of asPath to avoid transitions on query parameter changes
  const slug = Array.isArray(router.query.slug) ? router.query.slug[0] : router.query.slug;
  const pageKey = router.pathname + (slug || '');

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        style={{ minHeight: "100vh" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};