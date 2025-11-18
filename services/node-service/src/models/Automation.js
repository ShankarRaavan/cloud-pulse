module.exports = (sequelize, DataTypes) => {
    const Automation = sequelize.define('Automation', {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        group: { type: DataTypes.STRING },
        description: { type: DataTypes.TEXT },
        
        // Script source type
        sourceType: { 
            type: DataTypes.ENUM('inline', 'github'), 
            defaultValue: 'inline',
            allowNull: false 
        },
        
        // Inline script fields
        language: { type: DataTypes.STRING, allowNull: true },
        script: { type: DataTypes.TEXT, allowNull: true },
        
        // GitHub integration fields
        githubRepo: { type: DataTypes.STRING, allowNull: true },
        githubBranch: { type: DataTypes.STRING, defaultValue: 'main', allowNull: true },
        githubPath: { type: DataTypes.STRING, allowNull: true },
        githubToken: { type: DataTypes.TEXT, allowNull: true }, // Encrypted
        githubLastCommit: { type: DataTypes.STRING, allowNull: true },
        
        // Execution metadata
        lastRun: { type: DataTypes.DATE },
        status: { type: DataTypes.STRING },
        executionOutput: { type: DataTypes.TEXT },
        executionDuration: { type: DataTypes.INTEGER }, // milliseconds
        executionFiles: { type: DataTypes.JSON, defaultValue: {} }, // Store generated files/data
        
        // Environment variables as JSON
        environmentVars: { type: DataTypes.JSON, defaultValue: {} },
        
        // Scheduling (future enhancement)
        schedule: { type: DataTypes.STRING, allowNull: true },
        isScheduled: { type: DataTypes.BOOLEAN, defaultValue: false },
        nextRun: { type: DataTypes.DATE, allowNull: true }
    });
    return Automation;
};
