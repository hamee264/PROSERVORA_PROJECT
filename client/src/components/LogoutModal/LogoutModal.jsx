import { AnimatePresence, motion } from "framer-motion";
import { LogOut, X } from "lucide-react";

import "./LogoutModal.css";

function LogoutModal({ isOpen, onClose, onConfirm }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="logout-modal">
          <motion.button
            type="button"
            className="logout-modal__backdrop"
            onClick={onClose}
            aria-label="Close logout confirmation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="logout-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
            initial={{
              opacity: 0,
              y: 12,
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 8,
              scale: 0.98,
            }}
            transition={{
              duration: 0.18,
              ease: "easeOut",
            }}
          >
            <button
              type="button"
              className="logout-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.8} />
            </button>

            <div className="logout-modal__icon">
              <LogOut size={21} strokeWidth={1.8} />
            </div>

            <div className="logout-modal__content">
              <h2 id="logout-modal-title">Sign out?</h2>

              <p>
                You will need to sign in again to access your Proservora
                account.
              </p>
            </div>

            <div className="logout-modal__actions">
              <button
                type="button"
                className="logout-modal__cancel"
                onClick={onClose}
              >
                Stay signed in
              </button>

              <button
                type="button"
                className="logout-modal__confirm"
                onClick={onConfirm}
              >
                Sign out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default LogoutModal;
