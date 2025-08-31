'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MouseEvent } from 'react'
import FollowButton from '../social/FollowButton'
import AddFriendButton from '../social/AddFriendButton'

type Profile = {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
}

type Props = {
  user: Profile
  onClose?: () => void
}

export default function UserSearchResult({ user, onClose }: Props) {
  const stopNav = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const actionProps = {
    // Pasamos ambos nombres por compatibilidad con tus componentes
    userId: user.id,
    toUserId: user.id,
    targetUserId: user.id,
  } as any

  return (
    <Link
      href={`/${user.username}`}
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl hover:bg-neutral-50 transition"
    >
      {/* Izquierda: avatar + nombre */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-neutral-200 overflow-hidden flex-shrink-0">
          {user.avatar_url ? (
            <Image
              src={user.avatar_url}
              alt={user.full_name || user.username}
              width={36}
              height={36}
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="truncate">{user.full_name || user.username}</div>
          <div className="text-sm text-neutral-500 truncate">@{user.username}</div>
        </div>
      </div>

      {/* Derecha: acciones */}
      <div className="flex items-center gap-2" onClick={stopNav}>
        <FollowButton {...actionProps} />
        <AddFriendButton {...actionProps} onDone={onClose} />
      </div>
    </Link>
  )
}
