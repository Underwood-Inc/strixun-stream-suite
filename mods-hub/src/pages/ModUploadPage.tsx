/**
 * Mod upload page
 * Form for uploading new mods
 */

// useState imported but not used - removed
import { useNavigate } from 'react-router-dom';
import { useUploadMod } from '../hooks/useMods';
import { ModUploadForm } from '../components/mod/ModUploadForm';
import { useAuthStore } from '../stores/auth';
import styled from 'styled-components';
import { colors, spacing } from '../theme';

const PageContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
  margin-bottom: ${spacing.xl};
`;

const AuthRequired = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.textSecondary};
`;

export function ModUploadPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const uploadMod = useUploadMod();

    const handleSubmit = async (data: {
        file: File;
        metadata: any;
        thumbnail?: File;
    }) => {
        try {
            const result = await uploadMod.mutateAsync(data);
            navigate(`/mods/${result.mod.modId}`);
        } catch (error) {
            // Error handled by mutation
        }
    };

    if (!isAuthenticated) {
        return (
            <PageContainer>
                <AuthRequired>
                    Please log in to upload mods.
                </AuthRequired>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <Title>Upload Mod</Title>
            <ModUploadForm onSubmit={handleSubmit} isLoading={uploadMod.isPending} />
        </PageContainer>
    );
}

