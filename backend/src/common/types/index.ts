export interface Job {
  id: string;
  source: string;
  title: string;
  company: string | null;
  location: string | null;
  tags: string[];
  cleaned_tags: string[];
  link: string;
  description: string | null;
  created_at: string;
  scraped_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: string;
  created_at: string;
}
