import { motion } from "motion/react";
import "./Logo.css";

function Logo({
  variant = "mark",
  size = 40,
  animated = false,
  className = "",
}) {
  const src =
    variant === "full"
      ? "/images/proservora-logo.svg"
      : "/images/proservora-mark.png";

  const alt = variant === "full" ? "Proservora" : "Proservora logo";

  const imageStyle = {
    width: variant === "full" ? "auto" : size,
    height: variant === "full" ? "auto" : size,
  };

  if (animated) {
    return (
      <motion.img
        src={src}
        alt={alt}
        className={`logo logo--${variant} ${className}`}
        style={imageStyle}
        animate={{
          rotate: 360,
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`logo logo--${variant} ${className}`}
      style={imageStyle}
    />
  );
}

export default Logo;
