import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Card, Slider, Input, Toggle, Button } from '@/components/primitives';
import { colors, spacing } from '@/theme';
import { useScrollbarCustomizer, type ScrollbarConfig } from '@/hooks/useScrollbarCustomizer';
import { getStorage } from '@/services/storage';

const ControlGroup = styled.div`
  margin-bottom: ${spacing.lg};
`;

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.md};
  margin-bottom: ${spacing.sm};
`;

const SliderLabel = styled.label`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: ${colors.textSecondary};
  margin-bottom: ${spacing.xs};
`;

const SliderValue = styled.span`
  font-weight: 600;
  color: ${colors.accent};
  min-width: 45px;
  text-align: right;
`;

const ColorInputWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.md};
`;

const ColorPreview = styled.div<{ $color: string }>`
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background: ${({ $color }) => $color === 'transparent' ? 'transparent' : $color};
  border: 1px solid ${colors.border};
  flex-shrink: 0;
`;

const InfoText = styled.p`
  font-size: 0.8rem;
  color: ${colors.muted};
  margin-top: ${spacing.xs};
  line-height: 1.4;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${spacing.md};
  margin-top: ${spacing.lg};
`;

const ErrorMessage = styled.div`
  padding: ${spacing.md};
  background: rgba(234, 43, 31, 0.1);
  border: 1px solid ${colors.danger};
  border-radius: 4px;
  color: ${colors.danger};
  font-size: 0.85rem;
  margin-bottom: ${spacing.lg};
`;

const LoadingMessage = styled.div`
  padding: ${spacing.md};
  background: rgba(100, 149, 237, 0.1);
  border: 1px solid ${colors.info};
  border-radius: 4px;
  color: ${colors.info};
  font-size: 0.85rem;
  margin-bottom: ${spacing.lg};
`;

const STORAGE_KEY = 'scrollbarCustomizerConfig'; // Using same key as STORAGE_KEYS.SCROLLBAR_CUSTOMIZER

const DEFAULT_CONFIG: ScrollbarConfig = {
  width: 6,
  trackColor: 'transparent',
  thumbColor: '#3d3627',
  thumbHoverColor: '#888',
  borderRadius: 3,
  contentAdjustment: true,
};

/**
 * Scrollbar Customizer UI Component
 * 
 * Provides a visual interface to customize scrollbar appearance
 * using the CDN-hosted ScrollbarCustomizer module.
 */
export function ScrollbarCustomizer() {
  const { loaded, loading, error, instance, createInstance, getWorkerUrl } = useScrollbarCustomizer();
  
  const [config, setConfig] = useState<ScrollbarConfig>(DEFAULT_CONFIG);
  const [contentAdjustmentEnabled, setContentAdjustmentEnabled] = useState(true);

  // Load saved config from storage
  useEffect(() => {
    const storage = getStorage();
    const saved = storage.get<ScrollbarConfig>(STORAGE_KEY);
    if (saved) {
      setConfig({ ...DEFAULT_CONFIG, ...saved });
      setContentAdjustmentEnabled(saved.contentAdjustment ?? true);
    }
  }, []);

  // Apply config when instance is available
  useEffect(() => {
    if (loaded && instance && !instance.isInitialized) {
      // Instance exists but not initialized, reinitialize with our config
      if (window.ScrollbarCustomizer) {
        createInstance(config);
      }
    } else if (loaded && instance && instance.isInitialized) {
      // Update existing instance with our config
      instance.updateConfig(config);
      if (instance.toggleContentAdjustment) {
        instance.toggleContentAdjustment(contentAdjustmentEnabled);
      }
    }
  }, [loaded, instance, config, contentAdjustmentEnabled, createInstance]);

  // Save config to storage
  const saveConfig = useCallback((newConfig: ScrollbarConfig) => {
    const storage = getStorage();
    storage.set(STORAGE_KEY, newConfig);
  }, []);

  // Update config and save
  const updateConfig = useCallback((updates: Partial<ScrollbarConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveConfig(newConfig);
    
    if (instance) {
      instance.updateConfig(updates);
    }
  }, [config, instance, saveConfig]);

  // Handle width change
  const handleWidthChange = useCallback((value: number) => {
    updateConfig({ width: value });
  }, [updateConfig]);

  // Handle color change
  const handleColorChange = useCallback((key: 'thumbColor' | 'thumbHoverColor' | 'trackColor', value: string) => {
    // Convert transparent to actual transparent for track
    const colorValue = key === 'trackColor' && value === '#000000' ? 'transparent' : value;
    updateConfig({ [key]: colorValue });
  }, [updateConfig]);

  // Handle border radius change
  const handleBorderRadiusChange = useCallback((value: number) => {
    updateConfig({ borderRadius: value });
  }, [updateConfig]);

  // Handle content adjustment toggle
  const handleContentAdjustmentToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setContentAdjustmentEnabled(checked);
    const newConfig = { ...config, contentAdjustment: checked };
    setConfig(newConfig);
    saveConfig(newConfig);
    
    if (instance && instance.toggleContentAdjustment) {
      instance.toggleContentAdjustment(checked);
    }
  }, [config, instance, saveConfig]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setContentAdjustmentEnabled(true);
    saveConfig(DEFAULT_CONFIG);
    
    if (instance) {
      instance.destroy();
      if (window.ScrollbarCustomizer) {
        const newInstance = new window.ScrollbarCustomizer(DEFAULT_CONFIG);
        newInstance.init();
        window.ScrollbarCustomizerInstance = newInstance;
      }
    }
  }, [instance, saveConfig]);

  // Get color input value (convert transparent back to black for color input)
  const getColorInputValue = (color: string | undefined): string => {
    if (!color || color === 'transparent') return '#000000';
    return color;
  };

  if (loading) {
    return (
      <Card title="Scrollbar Customizer" icon=" ★ ">
        <LoadingMessage>
          Loading scrollbar customizer from {getWorkerUrl()}/cdn/scrollbar-customizer.js...
        </LoadingMessage>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Scrollbar Customizer" icon=" ★ ">
        <ErrorMessage>
          <strong>Error:</strong> {error}
        </ErrorMessage>
        <InfoText>
          Make sure your Cloudflare Worker is deployed and accessible at {getWorkerUrl()}
        </InfoText>
      </Card>
    );
  }

  return (
    <Card title="Scrollbar Customizer" icon=" ★ ">
      <InfoText>
        Customize the appearance of scrollbars across your application. Changes are applied immediately and saved automatically.
      </InfoText>

      <ControlGroup>
        <SliderLabel>
          <span>Scrollbar Width</span>
          <SliderValue>{config.width ?? 6}px</SliderValue>
        </SliderLabel>
        <Slider
          value={config.width ?? 6}
          onChange={(e) => handleWidthChange(Number(e.target.value))}
          min={4}
          max={20}
        />
      </ControlGroup>

      <ControlGroup>
        <SliderLabel>
          <span>Thumb Color</span>
        </SliderLabel>
        <ColorInputWrapper>
          <ColorPreview $color={config.thumbColor ?? '#3d3627'} />
          <Input
            type="color"
            value={getColorInputValue(config.thumbColor)}
            onChange={(e) => handleColorChange('thumbColor', e.target.value)}
            style={{ flex: 1 }}
          />
        </ColorInputWrapper>
      </ControlGroup>

      <ControlGroup>
        <SliderLabel>
          <span>Thumb Hover Color</span>
        </SliderLabel>
        <ColorInputWrapper>
          <ColorPreview $color={config.thumbHoverColor ?? '#888'} />
          <Input
            type="color"
            value={getColorInputValue(config.thumbHoverColor)}
            onChange={(e) => handleColorChange('thumbHoverColor', e.target.value)}
            style={{ flex: 1 }}
          />
        </ColorInputWrapper>
      </ControlGroup>

      <ControlGroup>
        <SliderLabel>
          <span>Track Color</span>
        </SliderLabel>
        <ColorInputWrapper>
          <ColorPreview $color={config.trackColor ?? 'transparent'} />
          <Input
            type="color"
            value={getColorInputValue(config.trackColor)}
            onChange={(e) => handleColorChange('trackColor', e.target.value)}
            style={{ flex: 1 }}
          />
        </ColorInputWrapper>
        <InfoText>
          Set to black (#000000) for transparent track
        </InfoText>
      </ControlGroup>

      <ControlGroup>
        <SliderLabel>
          <span>Border Radius</span>
          <SliderValue>{config.borderRadius ?? 3}px</SliderValue>
        </SliderLabel>
        <Slider
          value={config.borderRadius ?? 3}
          onChange={(e) => handleBorderRadiusChange(Number(e.target.value))}
          min={0}
          max={10}
        />
      </ControlGroup>

      <ControlGroup>
        <ControlRow>
          <Toggle
            checked={contentAdjustmentEnabled}
            onChange={handleContentAdjustmentToggle}
          />
          <span style={{ color: colors.textSecondary, fontSize: '0.85rem' }}>
            Content Adjustment (prevents layout shift when scrollbar appears/disappears)
          </span>
        </ControlRow>
      </ControlGroup>

      <ButtonRow>
        <Button variant="secondary" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </ButtonRow>
    </Card>
  );
}

