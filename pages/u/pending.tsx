export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/collection",
      permanent: false,
    },
  };
}

export default function PendingRedirect() {
  return null;
}
