/**
 * Interactive Poll Template Code
 *
 * A real-time voting poll with percentage bars and vote tracking.
 * Prevents double voting and displays live results.
 */

export const interactivePollCode = `import { useState } from 'react';

interface PollOption {
  id: number;
  text: string;
  votes: number;
}

export default function InteractivePoll() {
  const [hasVoted, setHasVoted] = useState(false);
  const [options, setOptions] = useState<PollOption[]>([
    { id: 1, text: 'Option A - The Classic Choice', votes: 0 },
    { id: 2, text: 'Option B - The Bold Alternative', votes: 0 },
    { id: 3, text: 'Option C - The Wild Card', votes: 0 },
    { id: 4, text: 'Option D - The Safe Bet', votes: 0 },
  ]);

  const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);

  const handleVote = (optionId: number) => {
    if (hasVoted) return;

    setOptions(prev =>
      prev.map(option =>
        option.id === optionId
          ? { ...option, votes: option.votes + 1 }
          : option
      )
    );
    setHasVoted(true);

    // TODO: Save vote to backend
    console.log('Voted for option:', optionId);
  };

  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const getWinningOption = () => {
    if (totalVotes === 0) return null;
    return options.reduce((max, option) =>
      option.votes > max.votes ? option : max
    );
  };

  const winningOption = getWinningOption();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 Quick Poll
          </h1>
          <p className="text-gray-600">
            What's your preference? Vote to see live results!
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {options.map((option) => {
            const percentage = getPercentage(option.votes);
            const isWinner = winningOption?.id === option.id && totalVotes > 0;

            return (
              <button
                key={option.id}
                onClick={() => handleVote(option.id)}
                disabled={hasVoted}
                className={\`relative w-full text-left p-4 rounded-lg border-2 transition-all duration-200 \${
                  hasVoted
                    ? 'cursor-default'
                    : 'hover:border-indigo-500 hover:shadow-md cursor-pointer'
                } \${
                  isWinner
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200'
                }\`}
              >
                {/* Background bar */}
                {hasVoted && (
                  <div
                    className={\`absolute inset-0 rounded-lg transition-all duration-500 \${
                      isWinner ? 'bg-green-100' : 'bg-indigo-100'
                    }\`}
                    style={{ width: \`\${percentage}%\` }}
                  />
                )}

                {/* Content */}
                <div className="relative flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {option.text}
                  </span>
                  {hasVoted && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">
                        {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
                      </span>
                      <span className={\`font-bold \${isWinner ? 'text-green-600' : 'text-indigo-600'}\`}>
                        {percentage}%
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Total votes */}
        <div className="text-center text-sm text-gray-500">
          {totalVotes === 0 ? (
            'No votes yet - be the first!'
          ) : (
            \`\${totalVotes} total \${totalVotes === 1 ? 'vote' : 'votes'}\`
          )}
        </div>

        {/* Reset button (for demo) */}
        {hasVoted && (
          <div className="text-center mt-6">
            <button
              onClick={() => {
                setHasVoted(false);
                setOptions(prev =>
                  prev.map(opt => ({ ...opt, votes: 0 }))
                );
              }}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Reset Poll (Demo)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
`;
