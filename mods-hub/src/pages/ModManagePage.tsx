/**
 * Mod management page
 * Allows authors to manage their mods (update, delete, add versions)
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useModDetail, useUpdateMod, useDeleteMod, useUploadVersion, useUpdateModStatus } from '../hooks/useMods';
import { useUploadPermission } from '../hooks/useUploadPermission';
import { ModManageForm } from '../components/mod/ModManageForm';
import { VersionUploadForm } from '../components/mod/VersionUploadForm';
import { ModVersionManagement } from '../components/mod/ModVersionManagement';
import { VariantManagement } from '../components/mod/VariantManagement';
import { useAuthStore } from '../stores/auth';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import type { ModStatus } from '../types/mod';

const PageContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
`;

const Unauthorized = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  background: ${colors.danger}20;
  border: 1px solid ${colors.danger};
  border-radius: 8px;
  color: ${colors.danger};
`;

const UnauthorizedTitle = styled.h2`
  margin: 0 0 ${spacing.md} 0;
  font-size: 1.25rem;
  font-weight: 600;
`;

const UnauthorizedMessage = styled.p`
  margin: ${spacing.sm} 0;
  font-size: 0.875rem;
`;

const Loading = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.textSecondary};
`;

export function ModManagePage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();
    const { hasPermission, isLoading: permissionLoading } = useUploadPermission();
    const { data, isLoading } = useModDetail(slug || '');
    const updateMod = useUpdateMod();
    const deleteMod = useDeleteMod();
    const uploadVersion = useUploadVersion();
    const updateStatus = useUpdateModStatus();

    if (isLoading || permissionLoading) return <Loading>Loading...</Loading>;
    if (!data) {
        return (
            <Unauthorized>
                <UnauthorizedTitle>Mod Not Found</UnauthorizedTitle>
                <UnauthorizedMessage>The mod you&apos;re looking for doesn&apos;t exist or has been deleted.</UnauthorizedMessage>
            </Unauthorized>
        );
    }
    if (!isAuthenticated) {
        return (
            <Unauthorized>
                <UnauthorizedTitle>Authentication Required</UnauthorizedTitle>
                <UnauthorizedMessage>Please log in to manage mods.</UnauthorizedMessage>
            </Unauthorized>
        );
    }
    if (!hasPermission) {
        return (
            <Unauthorized>
                <UnauthorizedTitle>Mod Management Permission Required</UnauthorizedTitle>
                <UnauthorizedMessage>
                    You do not have permission to manage mods. Only users with explicit mod-management permission can upload and manage mods.
                    <br />
                    <br />
                    Please request approval from an administrator.
                </UnauthorizedMessage>
            </Unauthorized>
        );
    }
    if (data.mod.authorId !== user?.userId) {
        return (
            <Unauthorized>
                <UnauthorizedTitle>Permission Denied</UnauthorizedTitle>
                <UnauthorizedMessage>You can only manage mods that you uploaded. This mod belongs to {data.mod.authorDisplayName || 'Unknown User'}.</UnauthorizedMessage>
            </Unauthorized>
        );
    }

    // CRITICAL: Check for customerId - required for mod operations
    if (!user?.customerId) {
        return (
            <Unauthorized>
                <UnauthorizedTitle>Customer Account Required</UnauthorizedTitle>
                <UnauthorizedMessage>
                    Your account is missing a customer association. This is required for mod management.
                    <br />
                    <br />
                    Please contact support or try logging out and back in to refresh your account information.
                </UnauthorizedMessage>
            </Unauthorized>
        );
    }

    const handleUpdate = async (updates: any, thumbnail?: File, variantFiles?: Record<string, File>) => {
        try {
            await updateMod.mutateAsync({ slug: slug!, updates, thumbnail, variantFiles });
        } catch {
            // Error handled by mutation
        }
    };

    const handleStatusChange = async (status: ModStatus) => {
        if (!data) return;
        try {
            await updateStatus.mutateAsync({ 
                modId: data.mod.modId, 
                status,
                reason: status === 'pending' ? 'Submitted for review by author' : undefined
            });
        } catch {
            // Error handled by mutation
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this mod? This action cannot be undone.')) {
            return;
        }
        try {
            await deleteMod.mutateAsync(slug!);
            navigate('/');
        } catch {
            // Error handled by mutation
        }
    };

    const handleVersionUpload = async (uploadData: { file: File; metadata: any }) => {
        if (!data) return;
        try {
            await uploadVersion.mutateAsync({
                modId: data.mod.modId, // Still use modId for version upload API
                file: uploadData.file,
                metadata: uploadData.metadata,
            });
        } catch {
            // Error handled by mutation
        }
    };

    return (
        <PageContainer>
            <Title>Manage Mod: {data.mod.title}</Title>
            <div style={{ color: colors.textSecondary, fontSize: '0.875rem', marginBottom: spacing.md }}>
                Last updated: {new Date(data.mod.updatedAt).toLocaleString()}
            </div>
            
            <ModManageForm
                mod={data.mod}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                isLoading={updateMod.isPending || deleteMod.isPending || updateStatus.isPending}
            />
            
            <VersionUploadForm
                modId={data.mod.modId}
                onSubmit={handleVersionUpload}
                isLoading={uploadVersion.isPending}
            />
            
            <ModVersionManagement
                modSlug={slug!}
                modId={data.mod.modId}
                versions={data.versions}
            />
            
            {data.mod.variants && data.mod.variants.length > 0 && (
                <VariantManagement
                    modSlug={slug!}
                    modId={data.mod.modId}
                    variants={data.mod.variants}
                />
            )}
        </PageContainer>
    );
}

