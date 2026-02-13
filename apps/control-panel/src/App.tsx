import { Button, Card, Checkbox, Input, Select, Slider, Spinner, Toggle } from '@/components';
import { GlobalStyle, colors, spacing } from '@/theme';
import { useState } from 'react';
import styled from 'styled-components';

/**
 * Temporary demo app to showcase the component library.
 * This will be replaced with the full application.
 */

const AppContainer = styled.div`
  min-height: 100vh;
  padding: ${spacing.xl};
  background: ${colors.bg};
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  margin-bottom: ${spacing.xl};
  padding-bottom: ${spacing.lg};
  border-bottom: 1px solid ${colors.border};
`;

const StatusDot = styled.span<{ $connected: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $connected }) => $connected ? colors.accent : colors.danger};
`;

const Title = styled.h1`
  font-size: 1.2rem;
  font-weight: 600;
`;

const Section = styled.section`
  margin-bottom: ${spacing.xxl};
`;

const SectionTitle = styled.h2`
  font-size: 0.9rem;
  color: ${colors.muted};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: ${spacing.md};
`;

const ComponentGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.md};
  align-items: center;
`;

const DemoCard = styled(Card)`
  max-width: 400px;
`;

const Row = styled.div`
  display: flex;
  gap: ${spacing.sm};
  align-items: center;
`;

const SliderValue = styled.span`
  min-width: 45px;
  font-weight: 600;
  color: ${colors.accent};
  text-align: right;
`;

export function App() {
  const [connected, setConnected] = useState(false);
  const [toggleOn, setToggleOn] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [sliderValue, setSliderValue] = useState(75);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const handleToggle = () => {
    setToggleLoading(true);
    setTimeout(() => {
      setToggleOn(!toggleOn);
      setToggleLoading(false);
    }, 500);
  };
  
  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };
  
  return (
    <>
      <GlobalStyle />
      <AppContainer>
        <Header>
          <StatusDot $connected={connected} />
          <Title>Strixun Stream Suite</Title>
          <Button 
            variant={connected ? 'danger' : 'primary'} 
            size="sm"
            onClick={() => setConnected(!connected)}
          >
            {connected ? 'Disconnect' : 'Connect'}
          </Button>
        </Header>
        
        <Section>
          <SectionTitle>Component Library Demo</SectionTitle>
          <p style={{ color: colors.textSecondary, marginBottom: spacing.lg }}>
            This is a preview of the new React component library for the control panel redesign.
          </p>
        </Section>
        
        <Section>
          <SectionTitle>Buttons</SectionTitle>
          <ComponentGrid>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="success">Success</Button>
            <Button variant="warning">Warning</Button>
            <Button variant="ghost">Ghost</Button>
            <Button loading onClick={handleLoadingDemo}>Loading</Button>
            <Button disabled>Disabled</Button>
          </ComponentGrid>
        </Section>
        
        <Section>
          <SectionTitle>Button Sizes</SectionTitle>
          <ComponentGrid>
            <Button size="sm" variant="primary">Small</Button>
            <Button size="md" variant="primary">Medium</Button>
            <Button size="lg" variant="primary">Large</Button>
          </ComponentGrid>
        </Section>
        
        <Section>
          <SectionTitle>Toggle</SectionTitle>
          <ComponentGrid>
            <Row>
              <Toggle 
                checked={toggleOn} 
                loading={toggleLoading}
                onChange={handleToggle}
              />
              <span>{toggleOn ? 'ON' : 'OFF'}</span>
            </Row>
            <Row>
              <Toggle checked disabled />
              <span>Disabled ON</span>
            </Row>
            <Row>
              <Toggle disabled />
              <span>Disabled OFF</span>
            </Row>
          </ComponentGrid>
        </Section>
        
        <Section>
          <SectionTitle>Slider</SectionTitle>
          <DemoCard title="Opacity Control" icon="[?]">
            <Row>
              <Slider 
                value={sliderValue}
                onChange={(e) => setSliderValue(Number(e.target.value))}
                min={0}
                max={100}
              />
              <SliderValue>{sliderValue}%</SliderValue>
            </Row>
            <Row style={{ marginTop: spacing.md }}>
              <Slider inline value={50} readOnly style={{ width: '100px' }} />
              <span style={{ color: colors.muted, fontSize: '0.85rem' }}>Inline variant</span>
            </Row>
          </DemoCard>
        </Section>
        
        <Section>
          <SectionTitle>Form Elements</SectionTitle>
          <DemoCard title="Connection Settings" icon="[SETTINGS]">
            <Input label="Host" placeholder="localhost" defaultValue="localhost" />
            <Input label="Port" placeholder="4455" defaultValue="4455" />
            <Select 
              label="Animation Type"
              options={[
                { value: 'fade', label: 'Fade' },
                { value: 'slide', label: 'Slide' },
                { value: 'zoom', label: 'Zoom' },
                { value: 'pop', label: 'Pop' },
              ]}
            />
            <Checkbox 
              label="Remember credentials"
              checked={checkboxChecked}
              onChange={(e) => setCheckboxChecked(e.target.checked)}
            />
          </DemoCard>
        </Section>
        
        <Section>
          <SectionTitle>Spinners</SectionTitle>
          <ComponentGrid>
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
            <Spinner color={colors.danger} />
          </ComponentGrid>
        </Section>
        
        <Section>
          <SectionTitle>Loading Button Demo</SectionTitle>
          <Button 
            variant="primary" 
            loading={loading}
            onClick={handleLoadingDemo}
          >
            {loading ? 'Processing...' : 'Click to Load (2s)'}
          </Button>
        </Section>
        
        <Card title="Collapsible Card" icon="[CARD]" collapsible>
          <p style={{ color: colors.textSecondary }}>
            This card can be collapsed by clicking the header.
            Great for organizing complex forms and settings.
          </p>
        </Card>
        
        <Card title="Default Collapsed" icon="[LOCK]" collapsible defaultCollapsed>
          <p style={{ color: colors.textSecondary }}>
            This card starts collapsed by default.
          </p>
        </Card>
      </AppContainer>
    </>
  );
}

