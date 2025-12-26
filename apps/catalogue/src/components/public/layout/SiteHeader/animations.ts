// Framer Motion animation variants - slide from left
export const slideVariants = {
  closed: {
    x: "-100%",
    transition: {
      type: "tween",
      duration: 0.25,
      ease: [0.4, 0.0, 0.2, 1],
    },
  },
  open: {
    x: "0%",
    transition: {
      type: "tween", 
      duration: 0.25,
      ease: [0.4, 0.0, 0.2, 1],
    },
  },
};

export const backdropVariants = {
  closed: {
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
  open: {
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
};

export const menuItemVariants = {
  closed: {
    x: 20,
    opacity: 0,
  },
  open: (i: number) => ({
    x: 0,
    opacity: 1,
    transition: {
      delay: i * 0.05,
      duration: 0.2,
      ease: [0.4, 0.0, 0.2, 1],
    },
  }),
};

export const containerVariants = {
  closed: {},
  open: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};