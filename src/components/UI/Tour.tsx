
import React from 'react';
import ReactJoyride, { CallBackProps, STATUS } from 'react-joyride';
import { useTheme } from '../../hooks/useTheme';

type TourProps = {
  run: boolean;
  onFinish: () => void;
};

export const Tour: React.FC<TourProps> = ({ run, onFinish }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const steps = [
    {
      target: '#sidebar',
      content: 'Access your chat history and start new conversations here.',
      disableBeacon: true,
    },
    {
      target: '#settings-trigger',
      content: 'Configure API keys, choose models, and customize your persona here.',
    },
    {
      target: '#main-chat-input',
      content: 'Type your message or attach files here to start chatting.',
    },
    {
      target: '#model-selector-trigger',
      content: 'Switch between different AI models on the fly.',
    }
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      onFinish();
    }
  };

  return (
    <ReactJoyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          arrowColor: isDark ? '#1e1e1e' : '#ffffff',
          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          primaryColor: '#6366f1',
          textColor: isDark ? '#f4f4f5' : '#1e293b',
          zIndex: 1000,
        }
      }}
    />
  );
};
