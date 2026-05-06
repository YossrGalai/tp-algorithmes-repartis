import { createBrowserRouter, Outlet } from 'react-router-dom';
import HomePage from '../pages/HomePage.tsx';
import RicartAgrawalaApp from '../pages/ricartagrawalaapp.tsx';
import Placeholder from '../pages/Placeholder.tsx';
import RingElectionPage from '../pages/RingElectionPage.tsx';
import BullyElectionPage from '../pages/BullyElectionPage.tsx';
import ScrollToTop from './ScrollToTop';
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
        element: <Placeholder name="Token Ring" />,
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
