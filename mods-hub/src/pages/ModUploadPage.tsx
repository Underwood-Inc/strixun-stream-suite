/**
 * Mod upload page
 * Form for uploading new mods
 */

// useState imported but not used - removed
import { useNavigate } from 'react-router-dom';
import { useUploadMod } from '../hooks/useMods';
import { useUploadPermission } from '../hooks/useUploadPermission';
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

const ErrorMessage = styled.div`
  text-align: center;
  padding: ${spacing.lg};
  background: ${colors.danger}20;
  border: 1px solid ${colors.danger};
  border-radius: 8px;
  color: ${colors.danger};
  margin-bottom: ${spacing.lg};
`;

const ErrorTitle = styled.h3`
  margin: 0 0 ${spacing.sm} 0;
  font-size: 1.125rem;
  font-weight: 600;
`;

const ErrorText = styled.p`
  margin: ${spacing.sm} 0;
  font-size: 0.875rem;
`;

function getErrorMessage(error: unknown): { title: string; message: string } | null {
    if (!error) return null;
    
    const errorMessage = (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
        ? error.message.toLowerCase()
        : String(error || 'Unknown error').toLowerCase();
    
    // Permission denied errors
    if (errorMessage.includes('permission') || errorMessage.includes('403') || errorMessage.includes('forbidden')) {
        if (errorMessage.includes('upload')) {
            return {
                title: 'Upload Permission Required',
                message: 'You do not have permission to upload mods. Please request approval from an administrator or ensure your email is in the allowed list.',
            };
        }
        return {
            title: 'Permission Denied',
            message: 'You do not have permission to perform this action. Please contact an administrator if you believe this is an error.',
        };
    }
    
    // Authentication errors
    if (errorMessage.includes('auth') || errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
        return {
            title: 'Authentication Required',
            message: 'Please log in to perform this action.',
        };
    }
    
    // Email restriction errors
    if (errorMessage.includes('email') && (errorMessage.includes('not authorized') || errorMessage.includes('not allowed'))) {
        return {
            title: 'Email Not Authorized',
            message: 'Your email address is not authorized to upload mods. Please contact an administrator to request access.',
        };
    }
    
    return null;
}

export function ModUploadPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const { hasPermission, isLoading: permissionLoading } = useUploadPermission();
    const uploadMod = useUploadMod();

    const handleSubmit = async (data: {
        file: File;
        metadata: any;
        thumbnail?: File;
    }) => {
        try {
            const result = await uploadMod.mutateAsync(data);
            navigate(`/mods/${result.mod.slug}`);
        } catch (error) {
            // Error handled by mutation (notification shown)
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

    if (permissionLoading) {
        return (
            <PageContainer>
                <AuthRequired>Checking permissions...</AuthRequired>
            </PageContainer>
        );
    }

    if (!hasPermission) {
        return (
            <PageContainer>
                <ErrorMessage>
                    <ErrorTitle>Upload Permission Required</ErrorTitle>
                    <ErrorText>
                        You do not have permission to upload mods. Please request approval from an administrator.
                        <br />
                        <br />
                        Only users with explicit mod-management permission can upload and manage mods.
                    </ErrorText>
                </ErrorMessage>
            </PageContainer>
        );
    }

    const uploadError = uploadMod.error ? getErrorMessage(uploadMod.error) : null;

    return (
        <PageContainer>
            <Title>Upload Mod</Title>
            {uploadError && (
                <ErrorMessage>
                    <ErrorTitle>{uploadError.title}</ErrorTitle>
                    <ErrorText>{uploadError.message}</ErrorText>
                </ErrorMessage>
            )}
            <ModUploadForm onSubmit={handleSubmit} isLoading={uploadMod.isPending} />
        </PageContainer>
    );
}

