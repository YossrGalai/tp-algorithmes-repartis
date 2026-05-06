import { createBrowserRouter, Outlet } from 'react-router-dom';
import HomePage from '../pages/HomePage.tsx';
import RicartAgrawalaApp from '../pages/ricartagrawalaapp.tsx';
import RingElectionPage from '../pages/RingElectionPage.tsx';
import BullyElectionPage from '../pages/BullyElectionPage.tsx';
import ScrollToTop from './ScrollToTop';
import TokenRingPage from '../pages/TokenRingPage.tsx';
import Snapshots from '../pages/Snapshots.tsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <>
        <ScrollToTop />
        <Outlet />
      </>
    ),
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/ricart-agrawala',
        element: <RicartAgrawalaApp />,
      },
      {
        path: '/token-ring',
        element: <TokenRingPage />,
      },
      {
        path: '/bully',
        element: <BullyElectionPage />,
      },
      {
        path: '/ring-election',
        element: <RingElectionPage />,
      },
      {
        path: '/snapshots',
        element: <Snapshots />,
      },
    ],
  },
]);

export default router;
