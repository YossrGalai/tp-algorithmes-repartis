import { createBrowserRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage.tsx';
import RicartAgrawalaApp from '../pages/ricartagrawalaapp.tsx';
import Placeholder from '../pages/Placeholder.tsx';


const router = createBrowserRouter([
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
    element: <Placeholder name="Bully Algorithm" />,
  },
  {
    path: '/ring-election',
    element: <Placeholder name="Ring Election Algorithm" />,
  },
]);

export default router;