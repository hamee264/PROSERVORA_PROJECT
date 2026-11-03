import { Link } from "react-router-dom";

import "./Button.css";

function Button({
  children = "Button",
  to,
  href,
  type = "button",
  className = "",
  disabled = false,
}) {
  const content = <span>{children}</span>;

  if (to) {
    return (
      <Link
        to={to}
        className={`proservora-button ${className}`}
        aria-disabled={disabled}
      >
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        className={`proservora-button ${className}`}
        aria-disabled={disabled}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={`proservora-button ${className}`}
      disabled={disabled}
    >
      {content}
    </button>
  );
}

export default Button;
