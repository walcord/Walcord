'use client';

import ListenerTakesViewer from '../../components/ListenerTakesViewer';

export default function ListenerTakesViewerPage() {
  // El componente resuelve automáticamente el profileId desde ?username
  // (o puede aceptar profileId si decides pasarlo en el futuro).
  return <ListenerTakesViewer />;
}
