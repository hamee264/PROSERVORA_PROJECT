import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Camera,
  Check,
  LoaderCircle,
  Save,
} from "lucide-react";

import { useAuth } from "../../../context/AuthContext";
import {
  getMyProfile,
  updateMyProfile,
  updateMyProfileImage,
} from "../../../services/userService";

import "./Profile.css";

const makeFormData = (user = {}) => ({
  firstName: user.first_name || user.firstName || "",
  lastName: user.last_name || user.lastName || "",
  username: user.username || "",
  phone: user.phone || "",
  bio: user.bio || "",
  country: user.country || "",
  city: user.city || "",
});

function Profile() {
  const { user, token, login } = useAuth();
  const avatarInputRef = useRef(null);

  const [profile, setProfile] = useState(user);
  const [formData, setFormData] = useState(() => makeFormData(user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const syncAuthUser = useEffectEvent((updatedUser) => {
    login({ token, user: updatedUser });
  });

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const data = await getMyProfile();
        if (!active || !data?.user) return;

        setProfile(data.user);
        setFormData(makeFormData(data.user));
        syncAuthUser(data.user);
      } catch (loadError) {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Unable to load your profile. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      setSaving(true);
      const data = await updateMyProfile(formData);
      const updatedUser = data?.user;

      if (!updatedUser) {
        throw new Error(
          "Profile was saved, but the updated details were not returned.",
        );
      }

      setProfile(updatedUser);
      setFormData(makeFormData(updatedUser));
      login({ token, user: updatedUser });
      setSuccess("Your profile has been updated.");
    } catch (saveError) {
      setError(
        saveError.response?.data?.message ||
          saveError.message ||
          "Unable to save your profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to update your profile photo.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photos must be 5 MB or smaller.");
      return;
    }

    setError("");
    setSuccess("");
    setAvatarPreview(URL.createObjectURL(file));

    try {
      setUploadingAvatar(true);
      const imageData = new FormData();
      imageData.append("image", file);

      const data = await updateMyProfileImage(imageData);
      const avatarUrl =
        data?.user?.profile?.avatar_url || data?.user?.avatar_url;

      if (!avatarUrl) {
        throw new Error("The uploaded photo URL was not returned.");
      }

      const updatedUser = { ...profile, avatar_url: avatarUrl };
      setProfile(updatedUser);
      login({ token, user: updatedUser });
      setAvatarPreview("");
      setSuccess("Your profile photo has been updated.");
    } catch (uploadError) {
      setAvatarPreview("");
      setError(
        uploadError.response?.data?.message ||
          uploadError.message ||
          "Unable to upload your profile photo. Please try again.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const profileImage =
    avatarPreview || profile?.avatar_url || profile?.avatarUrl || "";
  const fullName = [formData.firstName, formData.lastName]
    .filter(Boolean)
    .join(" ");
  const initials =
    [formData.firstName, formData.lastName]
      .filter(Boolean)
      .map((name) => name.charAt(0).toUpperCase())
      .join("") || "U";

  return (
    <div className="client-profile">
      <header className="client-profile__header">
        <div>
          <span className="client-profile__eyebrow">ACCOUNT</span>
          <h1>Your profile</h1>
          <p>Manage the details associated with your Proservora account.</p>
        </div>
      </header>

      {error && (
        <p
          className="client-profile__notice client-profile__notice--error"
          role="alert"
        >
          <AlertCircle size={17} />
          {error}
        </p>
      )}

      {success && (
        <p
          className="client-profile__notice client-profile__notice--success"
          role="status"
        >
          <Check size={17} />
          {success}
        </p>
      )}

      {loading ? (
        <div className="client-profile__loading" role="status">
          <LoaderCircle size={18} />
          Loading your profile...
        </div>
      ) : (
        <>
          <section
            className="client-profile__identity"
            aria-label="Profile summary"
          >
            <div className="client-profile__avatar">
              {profileImage ? (
                <img src={profileImage} alt={`${fullName || "Your"} profile`} />
              ) : (
                <span>{initials}</span>
              )}
              {profile?.is_email_verified && (
                <span
                  className="client-profile__verified"
                  title="Email verified"
                >
                  <BadgeCheck size={16} />
                </span>
              )}
            </div>

            <div className="client-profile__identity-copy">
              <span className="client-profile__section-label">
                PROFILE PHOTO
              </span>
              <h2>{fullName || "Add your name"}</h2>
              <p>{profile?.email || "Email unavailable"}</p>
            </div>

            <input
              ref={avatarInputRef}
              className="client-profile__file-input"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
              aria-label="Choose a profile photo"
            />
            <button
              type="button"
              className="client-profile__photo-button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <LoaderCircle size={16} />
              ) : (
                <Camera size={16} />
              )}
              <span>{uploadingAvatar ? "Uploading..." : "Change photo"}</span>
            </button>
            <span className="client-profile__photo-hint">
              JPG, PNG or WEBP · Max 5 MB
            </span>
          </section>

          <form className="client-profile__form" onSubmit={handleSave}>
            <div className="client-profile__section-heading">
              <div>
                <span className="client-profile__section-label">
                  PERSONAL DETAILS
                </span>
                <h2>Profile information</h2>
              </div>
              <span className="client-profile__required-note">* Required</span>
            </div>

            <div className="client-profile__grid">
              <label className="client-profile__field">
                <span>
                  First name <b>*</b>
                </span>
                <input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  autoComplete="given-name"
                  required
                  disabled={saving}
                />
              </label>

              <label className="client-profile__field">
                <span>
                  Last name <b>*</b>
                </span>
                <input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  autoComplete="family-name"
                  required
                  disabled={saving}
                />
              </label>

              <label className="client-profile__field">
                <span>Username</span>
                <input
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="username"
                  placeholder="Choose a public username"
                  disabled={saving}
                />
              </label>

              <label className="client-profile__field">
                <span>Phone number</span>
                <input
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                  placeholder="Add a contact number"
                  disabled={saving}
                />
              </label>

              <label className="client-profile__field">
                <span>City</span>
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  autoComplete="address-level2"
                  placeholder="Your city"
                  disabled={saving}
                />
              </label>

              <label className="client-profile__field">
                <span>Country</span>
                <input
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  autoComplete="country-name"
                  placeholder="Your country"
                  disabled={saving}
                />
              </label>

              <label className="client-profile__field client-profile__field--wide">
                <span>About you</span>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="A short introduction (optional)"
                  rows={4}
                  maxLength={500}
                  disabled={saving}
                />
                <small>{formData.bio.length}/500</small>
              </label>
            </div>

            <div className="client-profile__section-heading client-profile__section-heading--account">
              <div>
                <span className="client-profile__section-label">ACCOUNT</span>
                <h2>Sign-in details</h2>
              </div>
            </div>

            <div className="client-profile__account-grid">
              <div className="client-profile__readonly-field">
                <span>Email address</span>
                <strong>{profile?.email || "Email unavailable"}</strong>
                <small>
                  {profile?.is_email_verified ? "Verified" : "Not verified"}
                </small>
              </div>
              <div className="client-profile__readonly-field">
                <span>Account type</span>
                <strong>
                  {profile?.role === "provider" ? "Service provider" : "Client"}
                </strong>
                <small>Account type cannot be changed here</small>
              </div>
            </div>

            <div className="client-profile__actions">
              <button
                type="submit"
                className="client-profile__save-button"
                disabled={saving}
              >
                {saving ? <LoaderCircle size={17} /> : <Save size={17} />}
                <span>{saving ? "Saving..." : "Save changes"}</span>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export default Profile;
