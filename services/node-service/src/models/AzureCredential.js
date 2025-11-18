// Azure Credential Model
module.exports = (sequelize, DataTypes) => {
    const AzureCredential = sequelize.define('AzureCredential', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        tenantId: {
            type: DataTypes.STRING(36), // UUID length
            allowNull: false,
            comment: 'Azure Active Directory tenant ID'
        },
        clientId: {
            type: DataTypes.STRING(36), // UUID length
            allowNull: false,
            comment: 'Azure service principal client ID (Application ID)'
        },
        clientSecret: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'Azure service principal client secret (should be encrypted in production)'
        },
        subscriptionId: {
            type: DataTypes.STRING(36), // UUID length
            allowNull: false,
            comment: 'Azure subscription ID for cost management (primary subscription)'
        },
        subscriptionIds: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'JSON array of all selected subscription IDs'
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'azure_credentials',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['userId']
            }
        ]
    });

    AzureCredential.associate = function(models) {
        AzureCredential.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
    };

    return AzureCredential;
};