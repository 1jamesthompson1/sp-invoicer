# Invoice maker plugin for Super Productivity

**Warning doesn't currently work (bug with hours calculation)**

This plugin is 90% of the way there. However there is some bug in the hours calculation that I can't figure out. So currently the amounts it adds up for a month isn't the same as super-productivity. Maybe some timezone issue.

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies (if any are added in the future)
3. Make your changes to the files in the `plugin/` directory

### Building

Build the plugin using:

```bash
npm run build
```

This will create a distributable version of the plugin.

### Testing

To test the plugin in Super Productivity:

1. Build the plugin using `npm run build`
2. Load the built plugin file into Super Productivity
3. Test your changes

### Versioning

Version numbers are automatically synced between `package.json` and `plugin/manifest.json` during the build process. 

**To update the version:**

1. Only update the version in `package.json` (or use `npm version patch|minor|major`)
2. Run `npm run build`
3. The build script will automatically sync the version to `plugin/manifest.json`

The build script also syncs description, author, and homepage fields from `package.json` to `manifest.json`, keeping everything consistent.

### Pull Requests

Contributions are welcome! Please feel free to submit a pull request.