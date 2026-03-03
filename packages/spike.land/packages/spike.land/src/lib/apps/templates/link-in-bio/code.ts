/**
 * Link-in-Bio Template Code
 *
 * A clean, mobile-friendly link aggregation page perfect for social media bios.
 * Features a profile image, bio text, and customizable link buttons.
 */

export const linkInBioCode = `import { useState } from 'react';

interface LinkItem {
  id: number;
  title: string;
  url: string;
  icon?: string;
}

export default function LinkInBio() {
  const [links] = useState<LinkItem[]>([
    { id: 1, title: 'Website', url: 'https://example.com', icon: '🌐' },
    { id: 2, title: 'Blog', url: 'https://example.com/blog', icon: '📝' },
    { id: 3, title: 'Shop', url: 'https://example.com/shop', icon: '🛍️' },
    { id: 4, title: 'Contact', url: 'https://example.com/contact', icon: '✉️' },
  ]);

  const profileImage = 'https://via.placeholder.com/150';
  const profileName = 'Your Name';
  const profileBio = 'Add your bio here. Customize everything to match your brand!';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Profile Section */}
        <div className="text-center mb-8">
          <img
            src={profileImage}
            alt={profileName}
            className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white shadow-lg"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{profileName}</h1>
          <p className="text-gray-600">{profileBio}</p>
        </div>

        {/* Links */}
        <div className="space-y-3">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-white hover:bg-gray-50 text-gray-900 font-medium py-4 px-6 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg hover:scale-105"
            >
              {link.icon && <span className="text-xl">{link.icon}</span>}
              <span>{link.title}</span>
            </a>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          Built with ❤️ using Spike Land
        </div>
      </div>
    </div>
  );
}
`;
