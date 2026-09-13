import { Routes, Route } from "react-router";
import { ThemeProvider } from "@/providers/theme";
import AppLayout from "@/components/AppLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Welcome from "./pages/Welcome";
import Search from "./pages/Search";
import BookDetail from "./pages/BookDetail";
import BookReader from "./pages/BookReader";
import Communities from "./pages/Communities";
import CommunityDetail from "./pages/CommunityDetail";
import PostDetail from "./pages/PostDetail";
import Profile from "./pages/Profile";
import Shelves from "./pages/Shelves";
import Settings from "./pages/Settings";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/book/:externalId/read" element={<BookReader />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/book/:externalId" element={<BookDetail />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/w/:slug" element={<CommunityDetail />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/u/:username" element={<Profile />} />
          <Route path="/shelves" element={<Shelves />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Messages />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  );
}
