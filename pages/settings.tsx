'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

type Profile = {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Genre = {
  id: string;
  slug: string;
};

export default function SettingsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Inputs básicos de perfil
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Géneros favoritos (dos)
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [genresLoading, setGenresLoading] = useState<boolean>(false);
  const [genresSaving, setGenresSaving] = useState<boolean>(false);
  const [genresMessage, setGenresMessage] = useState<string | null>(null);

  // Cambio de contraseña
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Eliminación de cuenta (UI/estado)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const formatGenreLabel = (slug: string) =>
    slug.charAt(0).toUpperCase() + slug.slice(1);

  // Verificar sesión + cargar perfil y géneros
  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.push('/login');
        return;
      }

      const currentUser = data.user;

      setUserId(currentUser.id);
      setUserEmail(currentUser.email ?? null);
      setEmailInput(currentUser.email ?? '');

      // Cargar perfil
      setProfileLoading(true);
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, full_name, avatar_url')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData);
          setUsername(profileData.username ?? '');
          setDisplayName(profileData.full_name ?? '');
          setAvatarPreview(profileData.avatar_url ?? null);
        }
      } finally {
        setProfileLoading(false);
      }

      // Cargar géneros favoritos (dos) + lista completa de géneros
      setGenresLoading(true);
      try {
        const { data: genresData } = await supabase
          .from('genres')
          .select('id, slug')
          .order('slug');

        const mappedGenres: Genre[] = (genresData || []).map((g: any) => ({
          id: g.id as string,
          slug: g.slug as string,
        }));

        setAllGenres(mappedGenres);

        const { data: favRows } = await supabase
          .from('favourite_genres')
          .select('genre_id')
          .eq('user_id', currentUser.id);

        if (favRows?.length > 0) {
          const ids = Array.from(
            new Set(
              favRows
                .map((row: any) => row.genre_id as string | null)
                .filter(Boolean),
            ),
          ).slice(0, 2);

          setSelectedGenreIds(ids);
        } else {
          setSelectedGenreIds([]);
        }
      } catch {
        setAllGenres([]);
        setSelectedGenreIds([]);
      } finally {
        setGenresLoading(false);
      }
    };

    checkAuthAndLoadProfile();
  }, [router]);

  const handleSaveProfileBasics = async () => {
    if (!userId) return;
    setProfileBusy(true);
    setProfileMessage(null);

    try {
      const updates: Partial<Profile> = {
        username: username.trim() || null,
        full_name: displayName.trim() || null,
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

      if (error) throw error;

      setProfile((prev) =>
        prev
          ? { ...prev, ...updates }
          : {
              username: updates.username ?? null,
              full_name: updates.full_name ?? null,
              avatar_url: null,
            },
      );

      setProfileMessage('Profile updated');
    } catch (err: any) {
      setProfileMessage(err?.message || 'Could not update profile');
    } finally {
      setProfileBusy(false);
      setTimeout(() => setProfileMessage(null), 3500);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setAvatarBusy(true);

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${ext}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setAvatarPreview(publicUrl);
    } catch (err: any) {
      setAvatarError(err?.message || 'Error updating avatar');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!emailInput || emailInput === userEmail) return;
    setProfileBusy(true);
    setProfileMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        email: emailInput.trim(),
      });
      if (error) throw error;
      setUserEmail(emailInput.trim());
      setProfileMessage('We sent a confirmation link to your new email');
    } catch (err: any) {
      setProfileMessage(err?.message || 'Could not update email');
    } finally {
      setProfileBusy(false);
      setTimeout(() => setProfileMessage(null), 4000);
    }
  };

  const handleUpdatePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordBusy(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setPasswordSuccess('Password updated');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err?.message || 'Could not update password');
    } finally {
      setPasswordBusy(false);
    }
  };

  // Gestión de géneros (máx 2)
  const handleSelectGenre = (genreId: string) => {
    setSelectedGenreIds((prev) => {
      if (prev.includes(genreId)) return prev;
      if (prev.length >= 2) return [prev[0], genreId];
      return [...prev, genreId];
    });
  };

  const handleRemoveGenre = (genreId: string) => {
    setSelectedGenreIds((prev) => prev.filter((id) => id !== genreId));
  };

  const handleSaveGenres = async () => {
    if (!userId) return;
    setGenresSaving(true);
    setGenresMessage(null);

    try {
      await supabase.from('favourite_genres').delete().eq('user_id', userId);

      if (selectedGenreIds.length) {
        const rows = selectedGenreIds.slice(0, 2).map((genreId) => ({
          user_id: userId,
          genre_id: genreId,
        }));

        const { error: insertError } = await supabase.from('favourite_genres').insert(rows);

        if (insertError) throw insertError;
      }

      setGenresMessage('Genres updated');
    } catch (err: any) {
      setGenresMessage(err?.message || 'Could not update genres');
    } finally {
      setGenresSaving(false);
      setTimeout(() => setGenresMessage(null), 3500);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteErr(null);
    setDeleteBusy(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ hard: true }),
      });

      if (!res.ok) {
        try {
          // @ts-ignore
          const { error: rpcErr } = await supabase.rpc('delete_user_and_data');
          if (rpcErr) throw rpcErr;
        } catch (e: any) {
          throw new Error('No ha sido posible eliminar la cuenta.');
        }
      }

      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err: any) {
      setDeleteErr(err?.message || 'Unexpected error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = 'https://walcord.com/';
  };

  if (!userId || profileLoading) {
    return (
      <main className="min-h-screen bg-white text-black flex items-center justify-center font-[Roboto]">
        <p>Loading settings...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* TOP — back button (sticky + safe-area) */}
      <div className="sticky top-0 z-50 bg-white">
        <div className="w-full px-6 sm:px-12 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4 border-b border-neutral-200">
          <div className="flex items-end justify-between gap-4">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              title="Back"
              className="flex items-center gap-2 text-[#264AAE] font-light text-[0.95rem]"
            >
              <span className="text-[1.35rem] leading-none -mt-[1px]">‹</span>
              <span>Back</span>
            </button>

            <h1
              className="text-[clamp(1.6rem,4vw,2.2rem)] font-normal"
              style={{ fontFamily: 'Times New Roman, serif' }}
            >
              Settings
            </h1>

            <div className="w-[60px]" />
          </div>
        </div>
      </div>

      <div
        className="px-6 sm:px-12 max-w-3xl mx-auto space-y-10"
        style={{
          paddingBottom: 'calc(140px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Bloque superior: avatar + nombre + username */}
        <section className="pt-6 border-b border-neutral-200 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-8 gap-4">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 rounded-full overflow-hidden bg-neutral-200 flex items-center justify-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-neutral-500">No avatar</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <span className="px-3 py-1.5 rounded-full border border-neutral-800 text-neutral-900 text-xs tracking-wide uppercase hover:bg-neutral-900 hover:text-white transition">
                    Change photo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
                <p className="text-[0.75rem] text-neutral-500 max-w-[260px]">
                  Upload a photo from your gallery.
                </p>

                {avatarBusy && (
                  <p className="text-[0.75rem] text-neutral-600">Updating photo…</p>
                )}

                {avatarError && (
                  <p className="text-[0.75rem] text-red-600">{avatarError}</p>
                )}
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wide text-neutral-500">
                  Display name
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="border border-neutral-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1F48AF]"
                  placeholder="How people see you"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wide text-neutral-500">
                  Username
                </label>

                <div className="flex items-center border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white">
                  <span className="text-neutral-400">@</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                    className="ml-1 flex-1 outline-none bg-transparent"
                    placeholder="walcorduser"
                  />
                </div>

                <p className="text-[0.7rem] text-neutral-400">No spaces allowed.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="text-xs text-neutral-500">
              {profileMessage && <span>{profileMessage}</span>}
            </div>

            <button
              onClick={handleSaveProfileBasics}
              disabled={profileBusy}
              className="inline-flex items-center gap-2 rounded-full bg-[#1F48AF] text-white px-4 py-2 text-xs tracking-wide uppercase hover:brightness-110 active:scale-[0.99] disabled:opacity-60 transition"
            >
              {profileBusy ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </section>

        {/* Editar géneros seleccionados */}
        <section className="border-b border-neutral-200 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[0.95rem] text-neutral-800">Favourite genres</p>
              <p className="text-[0.8rem] text-neutral-500">
                Choose up to two genres. They appear on your profile header.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
              <div className="flex flex-wrap justify-end gap-2 min-h-[1.5rem]">
                {genresLoading ? (
                  <span className="text-xs text-neutral-400">Loading…</span>
                ) : selectedGenreIds.length ? (
                  selectedGenreIds.map((id) => {
                    const genre = allGenres.find((g) => g.id === id);
                    if (!genre) return null;

                    return (
                      <button
                        key={id}
                        onClick={() => handleRemoveGenre(id)}
                        className="px-3 py-1 rounded-full border border-[#1F48AF] text-[0.75rem] text-[#1F48AF] hover:bg-[#1F48AF] hover:text-white transition"
                      >
                        {formatGenreLabel(genre.slug)}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-xs text-neutral-400">No genres selected yet</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="border border-neutral-300 rounded-full px-3 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-[#1F48AF]"
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) handleSelectGenre(val);
                  }}
                >
                  <option value="">Select genre</option>
                  {allGenres
                    .filter((g) => !selectedGenreIds.includes(g.id))
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {formatGenreLabel(g.slug)}
                      </option>
                    ))}
                </select>

                <button
                  onClick={handleSaveGenres}
                  disabled={genresSaving}
                  className="px-4 py-1.5 rounded-full border border-[#1F48AF] text-xs uppercase tracking-wide text-[#1F48AF] hover:bg-[#1F48AF] hover:text-white transition disabled:opacity-50"
                >
                  {genresSaving ? 'Saving…' : 'Save'}
                </button>
              </div>

              {genresMessage && (
                <span className="text-[0.7rem] text-neutral-500">{genresMessage}</span>
              )}
            </div>
          </div>
        </section>

        {/* Email & contraseña */}
        <section className="border-b border-neutral-200 pb-8">
          <div className="space-y-6">
            {/* Email */}
            <div className="grid grid-cols-1 sm:grid-cols-[1.2fr,auto] gap-4 items-end">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wide text-neutral-500">
                  Email
                </label>

                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="border border-neutral-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1F48AF]"
                />

                <p className="text-[0.75rem] text-neutral-500">
                  Used for login and important updates.
                </p>
              </div>

              <button
                onClick={handleUpdateEmail}
                disabled={profileBusy || emailInput === userEmail}
                className="px-4 py-2 rounded-full border border-[#1F48AF] text-xs uppercase tracking-wide text-[#1F48AF] hover:bg-[#1F48AF] hover:text-white transition disabled:opacity-40"
              >
                Update email
              </button>
            </div>

            {/* Password */}
            <div className="mt-2">
              <p className="text-[0.9rem] text-neutral-800 mb-2">Change password</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border border-neutral-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1F48AF]"
                  placeholder="New password"
                />

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border border-neutral-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1F48AF]"
                  placeholder="Repeat password"
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <div className="text-xs">
                  {passwordError && <span className="text-red-600">{passwordError}</span>}
                  {passwordSuccess && (
                    <span className="text-neutral-700">{passwordSuccess}</span>
                  )}
                </div>

                <button
                  onClick={handleUpdatePassword}
                  disabled={passwordBusy}
                  className="px-4 py-2 rounded-full bg-[#1F48AF] text-white text-xs uppercase tracking-wide hover:brightness-110 disabled:opacity-50 transition"
                >
                  {passwordBusy ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & policies */}
        <section className="pb-4 border-neutral-200 border-b">
          <div className="flex items-center justify-between">
            <p className="text-[0.9rem] text-neutral-600">Data & privacy</p>

            <a
              href="/privacy"
              className="text-[0.8rem] underline underline-offset-2 text-neutral-500 hover:text-neutral-800"
            >
              Privacy & policies
            </a>
          </div>
        </section>

        {/* Log out + Delete account */}
        <section className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full bg-[#1F48AF] text-white px-4 py-2 text-sm hover:brightness-110 active:scale-[0.99] transition"
            >
              Log out
            </button>

            <button
              onClick={() => {
                setDeleteOpen(true);
                setDeleteErr(null);
                setDeleteConfirm('');
              }}
              className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[0.8rem] border border-red-500 text-red-600 bg-transparent hover:bg-red-50 active:scale-[0.99] transition"
              aria-label="Delete account"
              title="Delete account"
            >
              Delete account
            </button>

            {deleteErr && <span className="text-sm text-red-700 align-middle">{deleteErr}</span>}
          </div>
        </section>
      </div>

      {/* Modal Confirmación */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-lg bg-white shadow-xl p-6">
              <h4 className="text-lg font-medium">Confirm account deletion</h4>

              <p className="mt-2 text-sm text-neutral-700">
                Type{' '}
                <span className="font-mono bg-neutral-100 px-1 py-0.5 rounded">
                  DELETE
                </span>{' '}
                to confirm.
              </p>

              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="mt-4 w-full border border-neutral-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-[#1F48AF]"
                placeholder="Type DELETE"
              />

              {deleteErr && <div className="mt-3 text-sm text-red-700">{deleteErr}</div>}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    if (!deleteBusy) setDeleteOpen(false);
                  }}
                  className="px-4 py-2 text-sm rounded-md border border-neutral-300 hover:bg-neutral-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteBusy || deleteConfirm !== 'DELETE'}
                  className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteBusy ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
