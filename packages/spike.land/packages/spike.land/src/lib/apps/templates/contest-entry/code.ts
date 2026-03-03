/**
 * Contest Entry Form Template Code
 *
 * A complete contest entry form with validation and success confirmation.
 * Includes name, email, and essay question fields.
 */

export const contestEntryCode = `import { useState } from 'react';

interface FormData {
  name: string;
  email: string;
  answer: string;
}

export default function ContestEntry() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    answer: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!formData.answer.trim()) {
      newErrors.answer = 'Answer is required';
    } else if (formData.answer.trim().length < 10) {
      newErrors.answer = 'Answer must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setSubmitted(true);

    // TODO: Add your contest entry submission logic here
    console.log('Contest entry submitted:', formData);
  };

  const handleChange = (
    field: keyof FormData,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user types
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-lg w-full text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-4xl">🎉</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Entry Submitted!
          </h2>
          <p className="text-lg text-gray-600 mb-4">
            Thank you for entering, <strong>{formData.name}</strong>!
          </p>
          <p className="text-gray-500 mb-8">
            We've received your entry. Winners will be notified via email at{' '}
            <strong>{formData.email}</strong> on the contest end date.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
            <p className="text-sm text-amber-800">
              <strong>📧 Check your email</strong> for a confirmation message.
              Make sure to check your spam folder!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🏆 Enter to Win
          </h1>
          <p className="text-gray-600">
            Complete the form below for your chance to win amazing prizes!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={\`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all \${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }\`}
              placeholder="John Doe"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={\`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all \${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }\`}
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          {/* Essay Question */}
          <div>
            <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
              Why should you win? *
            </label>
            <textarea
              id="answer"
              value={formData.answer}
              onChange={(e) => handleChange('answer', e.target.value)}
              rows={5}
              className={\`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all resize-none \${
                errors.answer ? 'border-red-500' : 'border-gray-300'
              }\`}
              placeholder="Tell us why you deserve to win... (minimum 10 characters)"
            />
            {errors.answer && (
              <p className="mt-1 text-sm text-red-600">{errors.answer}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.answer.length} characters
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Entry'}
          </button>
        </form>

        {/* Rules Link */}
        <p className="text-xs text-gray-500 text-center mt-6">
          By submitting, you agree to the contest rules and terms.
        </p>
      </div>
    </div>
  );
}
`;
