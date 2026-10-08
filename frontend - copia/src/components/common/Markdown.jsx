import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Markdown = ({ children, components }) => (
  <div className="ori-md"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children || ""}</ReactMarkdown></div>
);
